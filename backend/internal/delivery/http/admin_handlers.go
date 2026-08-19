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
	// The admin edit form posts the whole tenant back, so the list has to
	// carry everything the form shows — otherwise saving would blank it.
	type row struct {
		ID          int64  `json:"id"`
		Name        string `json:"name"`
		Category    string `json:"category"`
		Booth       string `json:"booth"`
		Initials    string `json:"initials"`
		Kind        string `json:"kind"`
		Description string `json:"description"`
		LogoURL     string `json:"logo_url"`
		ContactName string `json:"contact_name"`
		Chapter     string `json:"chapter"`
		ScanCount   int    `json:"scan_count"`
	}
	out := make([]row, 0, len(ranking))
	for _, t := range ranking {
		out = append(out, row{
			ID: t.ID, Name: t.Name, Category: t.Category,
			Booth: t.Booth, Initials: t.Initials, Kind: t.Kind,
			Description: t.Description, LogoURL: t.LogoURL,
			ContactName: t.ContactName, Chapter: t.Chapter,
			ScanCount: t.ScanCount,
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

		Description string           `json:"description"`
		CoverURL    string           `json:"cover_url"`
		PosterURL   string           `json:"poster_url"`
		RundownID   int64            `json:"rundown_id"`
		StartsAt    string           `json:"starts_at,omitempty"`
		EndsAt      string           `json:"ends_at,omitempty"`
		Speakers    []map[string]any `json:"speakers"`
	}
	out := make([]row, 0, len(fill))
	for _, sem := range fill {
		people := make([]map[string]any, 0, len(sem.Speakers))
		for _, sp := range sem.Speakers {
			people = append(people, map[string]any{
				"name": sp.Name, "role": sp.Role, "title": sp.Title, "photo_url": sp.PhotoURL,
			})
		}
		out = append(out, row{
			ID: sem.ID, Slot: sem.Slot, Room: sem.Room, Title: sem.Title,
			Speaker: sem.Speaker, Moderator: sem.Moderator, Capacity: sem.Capacity,
			SeatsTaken: sem.SeatsTaken, Description: sem.Description,
			CoverURL: sem.CoverURL, PosterURL: sem.PosterURL, RundownID: sem.RundownID,
			StartsAt: mustStart(sem.StartsAt, sem.EndsAt), EndsAt: mustEnd(sem.StartsAt, sem.EndsAt),
			Speakers: people,
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
