package http

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"

	"natcon2026/backend/internal/domain"
)

/* ---------- DTOs ---------- */

type userDTO struct {
	ID         int64  `json:"id"`
	Name       string `json:"name"`
	Email      string `json:"email"`
	Role       string `json:"role"`
	MemberCode string `json:"member_code,omitempty"`
	Chapter    string `json:"chapter,omitempty"`
	Company    string `json:"company,omitempty"`
}

func toUserDTO(u *domain.User) userDTO {
	return userDTO{
		ID: u.ID, Name: u.Name, Email: u.Email, Role: string(u.Role),
		MemberCode: u.MemberCode, Chapter: u.Chapter, Company: u.Company,
	}
}

type statsDTO struct {
	TenantsVisited int `json:"tenants_visited"`
	TenantsTotal   int `json:"tenants_total"`
	Coupons        int `json:"coupons"`
	SeminarsPicked int `json:"seminars_picked"`
	SeminarsTotal  int `json:"seminars_total"`
}

/* ---------- Auth ---------- */

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Email == "" || req.Password == "" {
		respondError(w, http.StatusBadRequest, "email and password are required")
		return
	}
	token, user, err := s.auth.Login(r.Context(), req.Email, req.Password)
	if err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]any{
		"token": token,
		"user":  toUserDTO(user),
	})
}

/* ---------- Member ---------- */

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	user, stats, err := s.member.Profile(r.Context(), userIDFrom(r.Context()))
	if err != nil {
		respondDomainError(w, err)
		return
	}
	resp := map[string]any{"user": toUserDTO(user)}
	if stats != nil {
		resp["stats"] = statsDTO{
			TenantsVisited: stats.TenantsVisited,
			TenantsTotal:   stats.TenantsTotal,
			Coupons:        stats.Coupons,
			SeminarsPicked: stats.SeminarsPicked,
			SeminarsTotal:  stats.SeminarsTotal,
		}
	}
	respondJSON(w, http.StatusOK, resp)
}

func (s *Server) handleListTenants(w http.ResponseWriter, r *http.Request) {
	tenants, err := s.member.ListTenants(r.Context(), userIDFrom(r.Context()))
	if err != nil {
		respondDomainError(w, err)
		return
	}
	type tenantDTO struct {
		ID       int64  `json:"id"`
		Name     string `json:"name"`
		Category string `json:"category"`
		Booth    string `json:"booth"`
		Initials string `json:"initials"`
		Visited  bool   `json:"visited"`
	}
	out := make([]tenantDTO, 0, len(tenants))
	for _, t := range tenants {
		out = append(out, tenantDTO{
			ID: t.ID, Name: t.Name, Category: t.Category,
			Booth: t.Booth, Initials: t.Initials, Visited: t.Visited,
		})
	}
	respondJSON(w, http.StatusOK, map[string]any{"tenants": out})
}

func (s *Server) handleListSeminars(w http.ResponseWriter, r *http.Request) {
	seminars, err := s.seminar.List(r.Context(), userIDFrom(r.Context()))
	if err != nil {
		respondDomainError(w, err)
		return
	}
	type seminarDTO struct {
		ID        int64  `json:"id"`
		Slot      int    `json:"slot"`
		Room      string `json:"room"`
		Title     string `json:"title"`
		Speaker   string `json:"speaker"`
		Capacity  int    `json:"capacity"`
		SeatsLeft int    `json:"seats_left"`
		Registered bool  `json:"registered"`
	}
	out := make([]seminarDTO, 0, len(seminars))
	for _, sem := range seminars {
		out = append(out, seminarDTO{
			ID: sem.ID, Slot: sem.Slot, Room: sem.Room, Title: sem.Title,
			Speaker: sem.Speaker, Capacity: sem.Capacity,
			SeatsLeft: sem.Capacity - sem.SeatsTaken, Registered: sem.Registered,
		})
	}
	respondJSON(w, http.StatusOK, map[string]any{"seminars": out})
}

func (s *Server) handleRegisterSeminar(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid seminar id")
		return
	}
	if err := s.seminar.Register(r.Context(), id, userIDFrom(r.Context())); err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusCreated, map[string]string{"status": "registered"})
}

func (s *Server) handleUnregisterSeminar(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid seminar id")
		return
	}
	if err := s.seminar.Unregister(r.Context(), id, userIDFrom(r.Context())); err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "unregistered"})
}

/* ---------- Tenant / booth ---------- */

func (s *Server) handleScan(w http.ResponseWriter, r *http.Request) {
	var req struct {
		MemberCode string `json:"member_code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.MemberCode == "" {
		respondError(w, http.StatusBadRequest, "member_code is required")
		return
	}
	result, err := s.scan.Scan(r.Context(), userIDFrom(r.Context()), req.MemberCode)
	if err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]any{
		"member_name":    result.MemberName,
		"member_chapter": result.MemberChapter,
		"member_company": result.MemberCompany,
		"duplicate":      result.Duplicate,
		"coupons":        result.Coupons,
	})
}

func (s *Server) handleBooth(w http.ResponseWriter, r *http.Request) {
	booth, err := s.booth.Booth(r.Context(), userIDFrom(r.Context()))
	if err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]any{
		"id": booth.ID, "name": booth.Name, "category": booth.Category,
		"booth": booth.Booth, "initials": booth.Initials,
	})
}

func (s *Server) handleBoothStats(w http.ResponseWriter, r *http.Request) {
	stats, err := s.booth.Stats(r.Context(), userIDFrom(r.Context()))
	if err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]any{
		"total_scans": stats.TotalScans,
		"scans_today": stats.ScansToday,
	})
}

func (s *Server) handleBoothVisitors(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	visitors, err := s.booth.RecentVisitors(r.Context(), userIDFrom(r.Context()), limit)
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
	out := make([]visitorDTO, 0, len(visitors))
	for _, v := range visitors {
		out = append(out, visitorDTO{Name: v.Name, Chapter: v.Chapter, Company: v.Company, VisitedAt: v.VisitedAt})
	}
	respondJSON(w, http.StatusOK, map[string]any{"visitors": out})
}
