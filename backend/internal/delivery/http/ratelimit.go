package http

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
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
// account at once. That one stays in memory on purpose: it is a rough
// ceiling, it is allowed to be per-instance, and putting it in the database
// would mean a write for every request rather than every failure.
const (
	failedAttemptsPerAccount = 10
	addressAttemptsPerMinute = 2000
	attemptWindow            = time.Minute
)

// AuthAttempts is where failed attempts are counted. It is the database
// rather than this process's memory: behind a load balancer the API is
// several processes, and three in-memory counters are three times the limit
// anybody intended.
type AuthAttempts interface {
	RecentFailures(ctx context.Context, key string, window time.Duration) (int, error)
	RecordFailure(ctx context.Context, key string) error
}

// failureLimiter holds one account to a budget of wrong answers per window.
type failureLimiter struct {
	attempts AuthAttempts
	limit    int
	window   time.Duration
}

func newFailureLimiter(attempts AuthAttempts, limit int, window time.Duration) *failureLimiter {
	return &failureLimiter{attempts: attempts, limit: limit, window: window}
}

func (f *failureLimiter) blocked(ctx context.Context, key string) bool {
	n, err := f.attempts.RecentFailures(ctx, key, f.window)
	if err != nil {
		// Fail open. A database the limiter cannot read is a database the
		// sign-in behind it cannot use either, and turning the whole hall
		// away on a blip helps nobody.
		slog.Error("reading auth failure count", "err", err)
		return false
	}
	return n >= f.limit
}

func (f *failureLimiter) recordFailure(ctx context.Context, key string) {
	if err := f.attempts.RecordFailure(ctx, key); err != nil {
		slog.Error("recording auth failure", "err", err)
	}
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
			if f.blocked(r.Context(), key) {
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
				f.recordFailure(r.Context(), key)
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
