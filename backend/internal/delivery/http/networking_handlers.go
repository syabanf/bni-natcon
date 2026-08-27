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
			"table_no": t.TableNo, "name": t.Name, "hall": t.Hall,
			"capacity": t.Capacity, "occupied": t.Occupied,
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
				"company": m.Company, "classification": m.Classification,
				"seat_no": m.SeatNo, "is_me": m.IsMe, "saved": m.Saved, "note": m.Note,
			})
		}
		resp["table"] = tableDTO(map[string]any{
			"table_no": status.Table.TableNo, "name": status.Table.Name, "hall": status.Table.Hall,
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
		respondDecodeError(w, err, "table number is required")
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
		respondDecodeError(w, err, "unknown contact")
		return
	}
	if err := s.networking.SaveContact(r.Context(), userIDFrom(r.Context()), req.MemberID); err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "saved"})
}

func (s *Server) handleNetworkingHistory(w http.ResponseWriter, r *http.Request) {
	h, err := s.networking.History(r.Context(), userIDFrom(r.Context()))
	if err != nil {
		respondDomainError(w, err)
		return
	}
	tables := make([]map[string]any, 0, len(h.Tables))
	for _, t := range h.Tables {
		tables = append(tables, map[string]any{
			"table_no": t.TableNo, "hall": t.Hall, "joined_at": t.JoinedAt,
		})
	}
	contacts := make([]map[string]any, 0, len(h.Contacts))
	for _, c := range h.Contacts {
		contacts = append(contacts, map[string]any{
			"member_id": c.MemberID, "name": c.Name, "chapter": c.Chapter,
			"company": c.Company, "classification": c.Classification,
			"member_code": c.MemberCode, "note": c.Note,
			"saved_at": c.SavedAt,
		})
	}
	respondJSON(w, http.StatusOK, map[string]any{"tables": tables, "contacts": contacts})
}

func (s *Server) handleNetworkingTableDetail(w http.ResponseWriter, r *http.Request) {
	tableNo, ok := pathID(r)
	if !ok {
		respondError(w, http.StatusBadRequest, "unknown table")
		return
	}
	d, err := s.networking.TableDetail(r.Context(), userIDFrom(r.Context()), int(tableNo))
	if err != nil {
		respondDomainError(w, err)
		return
	}
	members := make([]map[string]any, 0, len(d.Members))
	for _, m := range d.Members {
		members = append(members, map[string]any{
			"member_id": m.MemberID, "name": m.Name, "chapter": m.Chapter,
			"company": m.Company, "classification": m.Classification,
			"seat_no": m.SeatNo, "is_me": m.IsMe, "saved": m.Saved, "note": m.Note,
		})
	}
	respondJSON(w, http.StatusOK, map[string]any{
		"table": map[string]any{
			"table_no": d.Table.TableNo, "name": d.Table.Name, "hall": d.Table.Hall,
			"capacity": d.Table.Capacity, "occupied": d.Table.Occupied,
		},
		"members": members,
	})
}

func (s *Server) handleNetworkingContactDetail(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		respondError(w, http.StatusBadRequest, "unknown contact")
		return
	}
	d, err := s.networking.ContactDetail(r.Context(), userIDFrom(r.Context()), id)
	if err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]any{
		"member_id": d.MemberID, "name": d.Name, "chapter": d.Chapter,
		"company": d.Company, "classification": d.Classification,
		"member_code": d.MemberCode, "email": d.Email,
		"note": d.Note, "saved_at": d.SavedAt,
		"current_table_no": d.CurrentTableNo,
	})
}

func (s *Server) handleNetworkingContactNote(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		respondError(w, http.StatusBadRequest, "unknown contact")
		return
	}
	var req struct {
		Note string `json:"note"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondDecodeError(w, err, "invalid data format")
		return
	}
	if err := s.networking.SetContactNote(r.Context(), userIDFrom(r.Context()), id, req.Note); err != nil {
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
