package http

import (
	"encoding/json"
	"net/http"
	"time"

	"natcon2026/backend/internal/domain"
)

func tableDTOs(tables []domain.NetworkingTable) []map[string]any {
	out := make([]map[string]any, 0, len(tables))
	for _, t := range tables {
		out = append(out, map[string]any{
			"id": t.ID, "table_no": t.TableNo, "name": t.Name, "hall": t.Hall,
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
		Name     string `json:"name"`
		Hall     string `json:"hall"`
		Capacity int    `json:"capacity"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondDecodeError(w, err, "invalid data format")
		return
	}
	if err := s.admin.UpdateTable(r.Context(), id, req.Name, req.Hall, req.Capacity); err != nil {
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

// handleAdminTableSeats is the committee's view of the ballroom while speed
// networking runs: every occupied seat, who is in it, and when they sat down.
// It is also the record afterwards — the seating is otherwise only in the
// attendees' phones.
func (s *Server) handleAdminTableSeats(w http.ResponseWriter, r *http.Request) {
	seats, err := s.admin.TableSeats(r.Context())
	if err != nil {
		respondDomainError(w, err)
		return
	}
	out := make([]map[string]any, 0, len(seats))
	for _, x := range seats {
		out = append(out, map[string]any{
			"table_no": x.TableNo, "table_name": x.TableName, "seat_no": x.SeatNo,
			"member_id": x.MemberID, "member_code": x.MemberCode, "name": x.Name,
			"chapter": x.Chapter, "company": x.Company, "classification": x.Classification,
			"phone":     x.Phone,
			"joined_at": x.JoinedAt.In(eventZone).Format(time.RFC3339),
		})
	}
	respondJSON(w, http.StatusOK, map[string]any{"seats": out})
}
