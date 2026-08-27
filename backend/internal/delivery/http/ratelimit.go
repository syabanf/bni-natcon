package http

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/httprate"
)

// Rate limiting that survives a venue.
//
// Every attendee at Pullman reaches the API through one public address: the
// hall's WiFi is a single NAT, and the ones on mobile data share their
// carrier's. A per-IP login limit therefore does not limit an attacker, it
// limits the building — at ten attempts a minute the eleventh person to sign
// in on the morning is turned away, and to everybody behind them the app
// simply looks broken. Worse, it never stopped the attack it was written for:
// guessing one account's password from a fresh address each time walked
// straight past it.
//
// Two rules replace it.
//
// The first counts WRONG answers against one account, wherever they come
// from. That is what a brute-force attempt actually is, and counting only
// failures is what lets a hall through: eight hundred people typing their own
// password correctly cost nothing, and one email can legitimately belong to
// seventeen ticket holders — a company that bought a block of passes, which
// this event has.
//
// The second is a ceiling per address, high enough that a venue on one NAT
// never notices it and low enough that a single machine cannot sweep every
// account at once.
const (
	failedAttemptsPerAccount = 10
	addressAttemptsPerMinute = 2000
	attemptWindow            = time.Minute
)

// failureLimiter is a sliding window over failed attempts, keyed by whatever
// identifies the account under attack.
type failureLimiter struct {
	mu        sync.Mutex
	limit     int
	window    time.Duration
	failures  map[string][]time.Time
	lastSweep time.Time
}

func newFailureLimiter(limit int, window time.Duration) *failureLimiter {
	return &failureLimiter{
		limit:    limit,
		window:   window,
		failures: make(map[string][]time.Time),
	}
}

// prune drops attempts that have aged out of the window. Callers hold the lock.
func (f *failureLimiter) prune(key string, now time.Time) {
	cut := now.Add(-f.window)
	kept := f.failures[key][:0]
	for _, t := range f.failures[key] {
		if t.After(cut) {
			kept = append(kept, t)
		}
	}
	if len(kept) == 0 {
		delete(f.failures, key)
		return
	}
	f.failures[key] = kept
}

// sweep keeps the map from growing for every address that ever guessed wrong.
// Callers hold the lock.
func (f *failureLimiter) sweep(now time.Time) {
	if now.Sub(f.lastSweep) < f.window {
		return
	}
	f.lastSweep = now
	for key := range f.failures {
		f.prune(key, now)
	}
}

func (f *failureLimiter) blocked(key string) bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.prune(key, time.Now())
	return len(f.failures[key]) >= f.limit
}

func (f *failureLimiter) recordFailure(key string) {
	now := time.Now()
	f.mu.Lock()
	defer f.mu.Unlock()
	f.prune(key, now)
	f.failures[key] = append(f.failures[key], now)
	f.sweep(now)
}

// middleware buckets by the identifier being attacked, lifted out of the JSON
// body. Fields are joined, so recovery is limited per person (chapter +
// phone) rather than per chapter.
func (f *failureLimiter) middleware(fields ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			body, err := io.ReadAll(r.Body)
			// Always put back whatever was read, error or not: the handler's
			// own decoder should be the one to report a malformed body.
			r.Body = io.NopCloser(bytes.NewReader(body))

			key := ""
			if err == nil {
				key = keyFromBody(body, fields)
			}
			if key == "" {
				// Nothing named to protect; the per-address ceiling covers it.
				next.ServeHTTP(w, r)
				return
			}
			if f.blocked(key) {
				w.Header().Set("Retry-After", strconv.Itoa(int(f.window.Seconds())))
				respondError(w, http.StatusTooManyRequests,
					"too many failed attempts for this account — wait a minute and try again")
				return
			}
			ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
			next.ServeHTTP(ww, r)
			// A wrong password, a wrong chapter/phone pair, a bad token. A
			// 404 is not counted: it is the same answer for everyone and
			// carries no secret.
			if ww.Status() == http.StatusUnauthorized {
				f.recordFailure(key)
			}
		})
	}
}

func keyFromBody(body []byte, fields []string) string {
	var probe map[string]any
	if json.Unmarshal(body, &probe) != nil {
		return ""
	}
	parts := make([]string, 0, len(fields))
	for _, f := range fields {
		s, _ := probe[f].(string)
		parts = append(parts, strings.ToLower(strings.TrimSpace(s)))
	}
	joined := strings.Join(parts, "\x00")
	if strings.Trim(joined, "\x00") == "" {
		return ""
	}
	return joined
}

// perAddress is the ceiling one machine cannot cross, whichever accounts it
// names.
func perAddress(requests int, window time.Duration) func(http.Handler) http.Handler {
	return httprate.LimitByIP(requests, window)
}
