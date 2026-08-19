package http

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"natcon2026/backend/internal/domain"
)

// Lucky Draw and Doorprize. Two draws, each with its own winners, its own
// entry condition, and a record that outlives the browser.

func entrantDTO(e domain.DrawEntrant) map[string]any {
	return map[string]any{
		"member_id": e.MemberID, "name": e.Name, "member_code": e.MemberCode,
		"chapter": e.Chapter, "company": e.Company, "visits": e.Visits,
	}
}

func winnerDTO(w domain.DrawWinner) map[string]any {
	out := entrantDTO(w.DrawEntrant)
	out["position"] = w.Position
	out["won_at"] = w.WonAt.In(eventZone).Format(time.RFC3339)
	return out
}

func (s *Server) handleDraws(w http.ResponseWriter, r *http.Request) {
	draws, err := s.admin.Draws(r.Context())
	if err != nil {
		respondDomainError(w, err)
		return
	}
	out := make([]map[string]any, 0, len(draws))
	for _, d := range draws {
		out = append(out, map[string]any{
			"key": d.Key, "name": d.Name,
			"min_booth_visits": d.MinBoothVisits, "winner_count": d.WinnerCount,
		})
	}
	respondJSON(w, http.StatusOK, map[string]any{"draws": out})
}

func (s *Server) handleDrawPool(w http.ResponseWriter, r *http.Request) {
	key := chi.URLParam(r, "key")
	pool, err := s.admin.DrawPool(r.Context(), key)
	if err != nil {
		respondDomainError(w, err)
		return
	}
	winners, err := s.admin.DrawWinners(r.Context(), key)
	if err != nil {
		respondDomainError(w, err)
		return
	}
	entrants := make([]map[string]any, 0, len(pool))
	for _, e := range pool {
		entrants = append(entrants, entrantDTO(e))
	}
	won := make([]map[string]any, 0, len(winners))
	for _, x := range winners {
		won = append(won, winnerDTO(x))
	}
	respondJSON(w, http.StatusOK, map[string]any{"eligible": entrants, "winners": won})
}

func (s *Server) handleDrawPick(w http.ResponseWriter, r *http.Request) {
	winner, err := s.admin.Pick(r.Context(), chi.URLParam(r, "key"))
	if err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusCreated, map[string]any{"winner": winnerDTO(*winner)})
}

func (s *Server) handleDrawMinimum(w http.ResponseWriter, r *http.Request) {
	var req struct {
		MinBoothVisits int `json:"min_booth_visits"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondDecodeError(w, err, "invalid data format")
		return
	}
	if err := s.admin.SetDrawMinimum(r.Context(), chi.URLParam(r, "key"), req.MinBoothVisits); err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (s *Server) handleDrawReset(w http.ResponseWriter, r *http.Request) {
	if err := s.admin.ResetDraw(r.Context(), chi.URLParam(r, "key")); err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "cleared"})
}
