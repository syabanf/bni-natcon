package http

import (
	"encoding/json"
	"net/http"
	"time"

	"natcon2026/backend/internal/domain"
)

// The event schedule. Admin edits it; attendees read it to fill the agenda on
// their home screen, which used to be a hard-coded list in the app bundle.

type rundownPayload struct {
	StartsAt string `json:"starts_at"` // RFC3339
	EndsAt   string `json:"ends_at"`   // RFC3339, optional — defaults to +1 hour
	Title    string `json:"title"`
	Place    string `json:"place"`
	Kind     string `json:"kind"`
	Sort     int    `json:"sort"`
}

func (p rundownPayload) toDomain() (domain.RundownBlock, error) {
	b := domain.RundownBlock{Title: p.Title, Place: p.Place, Kind: p.Kind, Sort: p.Sort}
	start, err := time.Parse(time.RFC3339, p.StartsAt)
	if err != nil {
		return b, err
	}
	b.StartsAt = start
	if p.EndsAt != "" {
		end, err := time.Parse(time.RFC3339, p.EndsAt)
		if err != nil {
			return b, err
		}
		b.EndsAt = end
	}
	return b, nil
}

func rundownDTO(b domain.RundownBlock) map[string]any {
	return map[string]any{
		"id":        b.ID,
		"starts_at": b.StartsAt.Format(time.RFC3339),
		"ends_at":   b.EndsAt.Format(time.RFC3339),
		"title":     b.Title,
		"place":     b.Place,
		"kind":      b.Kind,
		"sort":      b.Sort,
	}
}

func (s *Server) handleListRundown(w http.ResponseWriter, r *http.Request) {
	blocks, err := s.admin.ListRundown(r.Context())
	if err != nil {
		respondDomainError(w, err)
		return
	}
	out := make([]map[string]any, 0, len(blocks))
	for _, b := range blocks {
		out = append(out, rundownDTO(b))
	}
	respondJSON(w, http.StatusOK, map[string]any{"rundown": out})
}

func (s *Server) handleCreateRundown(w http.ResponseWriter, r *http.Request) {
	var req rundownPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondDecodeError(w, err, "invalid data format")
		return
	}
	block, err := req.toDomain()
	if err != nil {
		respondError(w, http.StatusBadRequest, "start and end must be a date and time")
		return
	}
	created, err := s.admin.CreateRundown(r.Context(), block)
	if err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusCreated, map[string]any{"block": rundownDTO(*created)})
}

func (s *Server) handleUpdateRundown(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		respondError(w, http.StatusBadRequest, "unknown record")
		return
	}
	var req rundownPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondDecodeError(w, err, "invalid data format")
		return
	}
	block, err := req.toDomain()
	if err != nil {
		respondError(w, http.StatusBadRequest, "start and end must be a date and time")
		return
	}
	if err := s.admin.UpdateRundown(r.Context(), id, block); err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]any{"status": "updated"})
}

func (s *Server) handleDeleteRundown(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		respondError(w, http.StatusBadRequest, "unknown record")
		return
	}
	if err := s.admin.DeleteRundown(r.Context(), id); err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]any{"status": "deleted"})
}
