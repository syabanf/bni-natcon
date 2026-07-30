package http

import (
	"net/http"
	"time"
)

func (s *Server) handleAdminMemberDetail(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		respondError(w, http.StatusBadRequest, "data tidak dikenali")
		return
	}
	d, err := s.admin.MemberDetail(r.Context(), id)
	if err != nil {
		respondDomainError(w, err)
		return
	}
	visits := make([]map[string]any, 0, len(d.Visits))
	for _, v := range d.Visits {
		visits = append(visits, map[string]any{
			"tenant_name": v.TenantName, "booth": v.Booth, "visited_at": v.VisitedAt,
		})
	}
	regs := make([]map[string]any, 0, len(d.Registrations))
	for _, v := range d.Registrations {
		regs = append(regs, map[string]any{
			"slot": v.Slot, "room": v.Room, "title": v.Title, "registered_at": v.RegisteredAt,
		})
	}
	respondJSON(w, http.StatusOK, map[string]any{
		"user":          toUserDTO(&d.User),
		"visits":        visits,
		"registrations": regs,
	})
}

func (s *Server) handleAdminTenantDetail(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		respondError(w, http.StatusBadRequest, "data tidak dikenali")
		return
	}
	d, err := s.admin.TenantDetail(r.Context(), id)
	if err != nil {
		respondDomainError(w, err)
		return
	}
	type visitorDTO struct {
		Name      string    `json:"name"`
		Chapter   string    `json:"chapter"`
		Company   string    `json:"company"`
		VisitedAt time.Time `json:"visited_at"`
	}
	visitors := make([]visitorDTO, 0, len(d.Visitors))
	for _, v := range d.Visitors {
		visitors = append(visitors, visitorDTO{Name: v.Name, Chapter: v.Chapter, Company: v.Company, VisitedAt: v.VisitedAt})
	}
	respondJSON(w, http.StatusOK, map[string]any{
		"tenant": map[string]any{
			"id": d.ID, "name": d.Name, "category": d.Category, "booth": d.Booth,
			"initials": d.Initials, "owner_email": d.OwnerEmail,
		},
		"total_scans": d.TotalScans,
		"scans_today": d.ScansToday,
		"visitors":    visitors,
	})
}

func (s *Server) handleAdminSeminarDetail(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		respondError(w, http.StatusBadRequest, "data tidak dikenali")
		return
	}
	d, err := s.admin.SeminarDetail(r.Context(), id)
	if err != nil {
		respondDomainError(w, err)
		return
	}
	attendees := make([]map[string]any, 0, len(d.Attendees))
	for _, a := range d.Attendees {
		attendees = append(attendees, map[string]any{
			"name": a.Name, "member_code": a.MemberCode, "chapter": a.Chapter,
			"company": a.Company, "registered_at": a.RegisteredAt,
		})
	}
	respondJSON(w, http.StatusOK, map[string]any{
		"seminar": map[string]any{
			"id": d.ID, "slot": d.Slot, "room": d.Room, "title": d.Title,
			"speaker": d.Speaker, "capacity": d.Capacity, "seats_taken": d.SeatsTaken,
		},
		"attendees": attendees,
	})
}
