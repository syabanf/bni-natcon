package http

import (
	"encoding/json"
	"net/http"
)

func (s *Server) handleAdminListChapters(w http.ResponseWriter, r *http.Request) {
	chapters, err := s.admin.ListChapters(r.Context())
	if err != nil {
		respondDomainError(w, err)
		return
	}
	out := make([]map[string]any, 0, len(chapters))
	for _, c := range chapters {
		out = append(out, map[string]any{"id": c.ID, "name": c.Name, "members": c.Members})
	}
	respondJSON(w, http.StatusOK, map[string]any{"chapters": out})
}

func (s *Server) handleAdminCreateChapter(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid data format")
		return
	}
	c, err := s.admin.CreateChapter(r.Context(), req.Name)
	if err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusCreated, map[string]any{
		"chapter": map[string]any{"id": c.ID, "name": c.Name, "members": 0},
	})
}

func (s *Server) handleAdminRenameChapter(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		respondError(w, http.StatusBadRequest, "unknown record")
		return
	}
	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid data format")
		return
	}
	if err := s.admin.RenameChapter(r.Context(), id, req.Name); err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (s *Server) handleAdminDeleteChapter(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		respondError(w, http.StatusBadRequest, "unknown record")
		return
	}
	if err := s.admin.DeleteChapter(r.Context(), id); err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
