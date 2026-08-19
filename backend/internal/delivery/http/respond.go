package http

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"

	"natcon2026/backend/internal/domain"
)

func respondJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func respondError(w http.ResponseWriter, status int, message string) {
	respondJSON(w, status, map[string]string{"error": message})
}

// respondDomainError maps domain errors to HTTP status codes. Domain error
// messages are already user-friendly Indonesian; internals are masked.
func respondDomainError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, domain.ErrNotFound):
		respondError(w, http.StatusNotFound, err.Error())
	case errors.Is(err, domain.ErrInvalidCredentials):
		respondError(w, http.StatusUnauthorized, err.Error())
	case errors.Is(err, domain.ErrSeminarFull),
		errors.Is(err, domain.ErrAlreadyRegistered),
		errors.Is(err, domain.ErrTooManySessions),
		errors.Is(err, domain.ErrSessionClash),
		errors.Is(err, domain.ErrDrawPoolEmpty),
		errors.Is(err, domain.ErrTableFull),
		errors.Is(err, domain.ErrNotRegistered),
		errors.Is(err, domain.ErrEmailTaken),
		errors.Is(err, domain.ErrNameTaken),
		errors.Is(err, domain.ErrChapterInUse),
		errors.Is(err, domain.ErrTableInUse):
		respondError(w, http.StatusConflict, err.Error())
	case errors.Is(err, domain.ErrInvalidInput):
		respondError(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, domain.ErrForbidden):
		respondError(w, http.StatusForbidden, err.Error())
	default:
		slog.Error("internal error", "err", err)
		respondError(w, http.StatusInternalServerError,
			"something went wrong on our side — please try again shortly")
	}
}

// respondDecodeError answers a request whose body could not be read.
//
// Two of these failures have a cause the client cannot guess from a generic
// "invalid data": a body past the size cap, and an empty one. Both used to
// arrive as whatever the handler's fallback said — a 5 MB import was
// reported as "the list is empty", which sends the committee looking at the
// wrong end of the problem. Everything else keeps the handler's own message,
// which is more specific than anything this function could invent.
func respondDecodeError(w http.ResponseWriter, err error, fallback string) {
	var tooLarge *http.MaxBytesError
	switch {
	case errors.As(err, &tooLarge):
		respondError(w, http.StatusRequestEntityTooLarge, fmt.Sprintf(
			"that request is larger than the %s limit — import it in smaller batches",
			humanBytes(tooLarge.Limit)))
	case errors.Is(err, io.EOF):
		respondError(w, http.StatusBadRequest, "the request arrived empty — nothing was sent")
	default:
		respondError(w, http.StatusBadRequest, fallback)
	}
}

// humanBytes renders a byte cap the way the person reading the message thinks
// about it: "2 MB", not "2097152".
func humanBytes(n int64) string {
	const mb = 1 << 20
	if n >= mb && n%mb == 0 {
		return fmt.Sprintf("%d MB", n/mb)
	}
	if n >= mb {
		return fmt.Sprintf("%.1f MB", float64(n)/mb)
	}
	return fmt.Sprintf("%d KB", n/1024)
}
