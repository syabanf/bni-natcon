package http

import (
	"net/http"
	"strconv"
	"time"
)

func (s *Server) handleAdminOverview(w http.ResponseWriter, r *http.Request) {
	o, err := s.admin.Overview(r.Context())
	if err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]any{
		"total_members":         o.TotalMembers,
		"total_tenants":         o.TotalTenants,
		"total_sponsors":        o.TotalSponsors,
		"total_booths":          o.TotalBooths,
		"total_visits":          o.TotalVisits,
		"visits_today":          o.VisitsToday,
		"seminar_registrations": o.SeminarRegistrations,
		"members_with_visit":    o.MembersWithVisit,
	})
}

func (s *Server) handleAdminTenants(w http.ResponseWriter, r *http.Request) {
	ranking, err := s.admin.TenantRanking(r.Context())
	if err != nil {
		respondDomainError(w, err)
		return
	}
	type row struct {
		ID        int64  `json:"id"`
		Name      string `json:"name"`
		Category  string `json:"category"`
		Booth     string `json:"booth"`
		Initials  string `json:"initials"`
		Kind      string `json:"kind"`
		ScanCount int    `json:"scan_count"`
	}
	out := make([]row, 0, len(ranking))
	for _, t := range ranking {
		out = append(out, row{
			ID: t.ID, Name: t.Name, Category: t.Category,
			Booth: t.Booth, Initials: t.Initials, Kind: t.Kind, ScanCount: t.ScanCount,
		})
	}
	respondJSON(w, http.StatusOK, map[string]any{"tenants": out})
}

func (s *Server) handleAdminSeminars(w http.ResponseWriter, r *http.Request) {
	fill, err := s.admin.SeminarFill(r.Context())
	if err != nil {
		respondDomainError(w, err)
		return
	}
	type row struct {
		ID         int64  `json:"id"`
		Slot       int    `json:"slot"`
		Room       string `json:"room"`
		Title      string `json:"title"`
		Speaker    string `json:"speaker"`
		Moderator  string `json:"moderator"`
		Capacity   int    `json:"capacity"`
		SeatsTaken int    `json:"seats_taken"`
	}
	out := make([]row, 0, len(fill))
	for _, sem := range fill {
		out = append(out, row{
			ID: sem.ID, Slot: sem.Slot, Room: sem.Room, Title: sem.Title,
			Speaker: sem.Speaker, Moderator: sem.Moderator, Capacity: sem.Capacity,
			SeatsTaken: sem.SeatsTaken,
		})
	}
	respondJSON(w, http.StatusOK, map[string]any{"seminars": out})
}

func (s *Server) handleAdminActivity(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	items, err := s.admin.RecentActivity(r.Context(), limit)
	if err != nil {
		respondDomainError(w, err)
		return
	}
	type row struct {
		MemberName string    `json:"member_name"`
		Chapter    string    `json:"chapter"`
		TenantName string    `json:"tenant_name"`
		Booth      string    `json:"booth"`
		VisitedAt  time.Time `json:"visited_at"`
	}
	out := make([]row, 0, len(items))
	for _, a := range items {
		out = append(out, row{
			MemberName: a.MemberName, Chapter: a.Chapter,
			TenantName: a.TenantName, Booth: a.Booth, VisitedAt: a.VisitedAt,
		})
	}
	respondJSON(w, http.StatusOK, map[string]any{"activity": out})
}
