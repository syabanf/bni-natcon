package http

import (
	"encoding/json"
	"net/http"

	"natcon2026/backend/internal/domain"
)

func tableDTOs(tables []domain.NetworkingTable) []map[string]any {
	out := make([]map[string]any, 0, len(tables))
	for _, t := range tables {
		out = append(out, map[string]any{
			"id": t.ID, "table_no": t.TableNo, "hall": t.Hall,
			"capacity": t.Capacity, "occupied": t.Occupied,
		})
	}
	return out
}

func (s *Server) handleAdminListTables(w http.ResponseWriter, r *http.Request) {
	tables, err := s.admin.ListTables(r.Context())
	if err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]any{"tables": tableDTOs(tables)})
}

func (s *Server) handleAdminGenerateTables(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Count    int    `json:"count"`
		Hall     string `json:"hall"`
		Capacity int    `json:"capacity"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondDecodeError(w, err, "invalid data format")
		return
	}
	if req.Capacity == 0 {
		req.Capacity = 8
	}
	created, err := s.admin.GenerateTables(r.Context(), req.Count, req.Hall, req.Capacity)
	if err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusCreated, map[string]any{
		"created": len(created),
		"tables":  tableDTOs(created),
	})
}

func (s *Server) handleAdminUpdateTable(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		respondError(w, http.StatusBadRequest, "unknown record")
		return
	}
	var req struct {
		Hall     string `json:"hall"`
		Capacity int    `json:"capacity"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondDecodeError(w, err, "invalid data format")
		return
	}
	if err := s.admin.UpdateTable(r.Context(), id, req.Hall, req.Capacity); err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (s *Server) handleAdminDeleteTable(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		respondError(w, http.StatusBadRequest, "unknown record")
		return
	}
	if err := s.admin.DeleteTable(r.Context(), id); err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
