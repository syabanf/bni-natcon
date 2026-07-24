package http

import (
	"encoding/json"
	"net/http"
)

func tableDTO(t map[string]any) map[string]any { return t }

func (s *Server) handleNetworkingStatus(w http.ResponseWriter, r *http.Request) {
	status, err := s.networking.Status(r.Context(), userIDFrom(r.Context()))
	if err != nil {
		respondDomainError(w, err)
		return
	}
	tables := make([]map[string]any, 0, len(status.Tables))
	for _, t := range status.Tables {
		tables = append(tables, map[string]any{
			"table_no": t.TableNo, "hall": t.Hall, "capacity": t.Capacity, "occupied": t.Occupied,
		})
	}
	resp := map[string]any{
		"checked_in": status.CheckedIn,
		"tables":     tables,
	}
	if status.CheckedIn && status.Table != nil {
		mates := make([]map[string]any, 0, len(status.Mates))
		for _, m := range status.Mates {
			mates = append(mates, map[string]any{
				"member_id": m.MemberID, "name": m.Name, "chapter": m.Chapter,
				"company": m.Company, "seat_no": m.SeatNo, "is_me": m.IsMe, "saved": m.Saved,
			})
		}
		resp["table"] = tableDTO(map[string]any{
			"table_no": status.Table.TableNo, "hall": status.Table.Hall,
			"capacity": status.Table.Capacity, "occupied": status.Table.Occupied,
		})
		resp["seat_no"] = status.SeatNo
		resp["mates"] = mates
	}
	respondJSON(w, http.StatusOK, resp)
}

func (s *Server) handleNetworkingCheckIn(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TableNo int `json:"table_no"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.TableNo <= 0 {
		respondError(w, http.StatusBadRequest, "table_no is required")
		return
	}
	if err := s.networking.CheckIn(r.Context(), userIDFrom(r.Context()), req.TableNo); err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "checked_in"})
}

func (s *Server) handleNetworkingSaveContact(w http.ResponseWriter, r *http.Request) {
	var req struct {
		MemberID int64 `json:"member_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.MemberID <= 0 {
		respondError(w, http.StatusBadRequest, "member_id is required")
		return
	}
	if err := s.networking.SaveContact(r.Context(), userIDFrom(r.Context()), req.MemberID); err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "saved"})
}

func (s *Server) handleNetworkingSaveAll(w http.ResponseWriter, r *http.Request) {
	saved, err := s.networking.SaveAll(r.Context(), userIDFrom(r.Context()))
	if err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]any{"status": "saved", "saved": saved})
}
