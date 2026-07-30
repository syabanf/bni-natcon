package http

import (
	"encoding/json"
	"errors"
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
		errors.Is(err, domain.ErrTableFull),
		errors.Is(err, domain.ErrNotRegistered),
		errors.Is(err, domain.ErrEmailTaken):
		respondError(w, http.StatusConflict, err.Error())
	case errors.Is(err, domain.ErrInvalidInput):
		respondError(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, domain.ErrForbidden):
		respondError(w, http.StatusForbidden, err.Error())
	default:
		slog.Error("internal error", "err", err)
		respondError(w, http.StatusInternalServerError,
			"terjadi kesalahan pada server — coba beberapa saat lagi")
	}
}
