package http

import (
	"encoding/json"
	"net/http"
	"time"

	"natcon2026/backend/internal/usecase"
)

// The speed-networking round. Attendees read it; the committee starts and
// stops it.

func sessionDTO(st usecase.SessionState) map[string]any {
	// server_now is not decoration: a phone whose clock is ten minutes out
	// would otherwise show a countdown ten minutes wrong. The app takes the
	// difference once and counts from there.
	out := map[string]any{
		"server_now": st.Now.In(eventZone).Format(time.RFC3339),
		"running":    false,
	}
	if st.Session == nil {
		return out
	}
	s := st.Session
	out["round"] = s.Round
	out["starts_at"] = s.StartsAt.In(eventZone).Format(time.RFC3339)
	out["ends_at"] = s.EndsAt.In(eventZone).Format(time.RFC3339)
	out["running"] = s.Live(st.Now)
	if s.StoppedAt != nil {
		out["stopped_at"] = s.StoppedAt.In(eventZone).Format(time.RFC3339)
	}
	return out
}

func (s *Server) handleNetworkingSession(w http.ResponseWriter, r *http.Request) {
	st, err := s.admin.CurrentSession(r.Context())
	if err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, sessionDTO(st))
}

func (s *Server) handleStartNetworkingSession(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Minutes int `json:"minutes"`
	}
	// An empty body is fine — it means "the usual round".
	_ = json.NewDecoder(r.Body).Decode(&req)

	st, err := s.admin.StartSession(r.Context(), req.Minutes)
	if err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusCreated, sessionDTO(st))
}

func (s *Server) handleStopNetworkingSession(w http.ResponseWriter, r *http.Request) {
	if err := s.admin.StopSession(r.Context()); err != nil {
		respondDomainError(w, err)
		return
	}
	st, err := s.admin.CurrentSession(r.Context())
	if err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, sessionDTO(st))
}
