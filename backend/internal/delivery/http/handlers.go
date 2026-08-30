package http

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"natcon2026/backend/internal/domain"
	"natcon2026/backend/internal/usecase"
	"time"
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
	Phone      string `json:"phone,omitempty"`

	Classification string `json:"classification,omitempty"`
	// The app routes straight to "choose your password" when this is true.
	MustSetPassword bool   `json:"must_set_password,omitempty"`
	TicketNumber    string `json:"ticket_number,omitempty"`
	// MustConsent is true for an attendee who has not yet agreed to the data
	// notice. The app shows it on the same first-run screen as the password
	// and will not go past it until the box is ticked.
	MustConsent bool `json:"must_consent,omitempty"`
	// Whether the registration desk has scanned this attendee's QR and
	// handed over the pin / goodiebag.
	PinRedeemed       bool `json:"pin_redeemed,omitempty"`
	GoodiebagRedeemed bool `json:"goodiebag_redeemed,omitempty"`
}

func toUserDTO(u *domain.User) userDTO {
	return userDTO{
		ID: u.ID, Name: u.Name, Email: u.Email, Role: string(u.Role),
		MemberCode: u.MemberCode, Chapter: u.Chapter, Company: u.Company,
		Phone: u.Phone, Classification: u.Classification,
		MustSetPassword: u.MustSetPassword, TicketNumber: u.TicketNumber,
		// Asked of attendees only: a booth's scanner login belongs to the
		// company, and the crew consent the committee needs from them is not
		// the one an attendee gives about their own name and email.
		MustConsent:       u.Role == domain.RoleMember && u.ConsentedAt == nil,
		PinRedeemed:       u.PinRedeemedAt != nil,
		GoodiebagRedeemed: u.GoodiebagRedeemedAt != nil,
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
		respondDecodeError(w, err, "email and password are required")
		return
	}
	res, err := s.auth.Login(r.Context(), req.Email, req.Password)
	if err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, loginResponse(res))
}

// loginResponse is either a session or a list of accounts to choose from.
func loginResponse(res *usecase.LoginResult) map[string]any {
	if res.Choice == "" {
		return map[string]any{"token": res.Token, "user": toUserDTO(res.User)}
	}
	accounts := make([]map[string]any, 0, len(res.Accounts))
	for _, a := range res.Accounts {
		accounts = append(accounts, map[string]any{
			"id": a.ID, "name": a.Name, "member_code": a.MemberCode,
			"chapter": a.Chapter, "company": a.Company,
			"ticket_number": a.TicketNumber,
		})
	}
	return map[string]any{
		"choose":       true,
		"choice_token": res.Choice,
		"accounts":     accounts,
	}
}

// handleSelectAccount finishes a sign-in that offered a choice between the
// accounts sharing one email.
func (s *Server) handleSelectAccount(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ChoiceToken string `json:"choice_token"`
		UserID      int64  `json:"user_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondDecodeError(w, err, "invalid data format")
		return
	}
	res, err := s.auth.SelectAccount(r.Context(), req.ChoiceToken, req.UserID)
	if err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, loginResponse(res))
}

// handleSetPassword is the first-login screen: swap the password generated at
// import time for one the attendee chose.
func (s *Server) handleSetPassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondDecodeError(w, err, "invalid data format")
		return
	}
	if err := s.auth.SetPassword(r.Context(), userIDFrom(r.Context()), req.Password); err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "password set"})
}

// handleConsent records that an attendee agreed to the data notice on the
// first-run screen.
func (s *Server) handleConsent(w http.ResponseWriter, r *http.Request) {
	if err := s.auth.RecordConsent(r.Context(), userIDFrom(r.Context())); err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "consent recorded"})
}

// handleForgotPassword checks chapter + the phone number on the ticket and,
// when they match, hands back a short-lived token for handleResetPassword.
func (s *Server) handleForgotPassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Chapter string `json:"chapter"`
		Phone   string `json:"phone"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondDecodeError(w, err, "invalid data format")
		return
	}
	found, err := s.auth.ForgotPassword(r.Context(), req.Chapter, req.Phone)
	if err != nil {
		respondDomainError(w, err)
		return
	}
	// One phone can carry two tickets, so the answer is always a list — the
	// app picks for the attendee when there is only one.
	accounts := make([]map[string]any, 0, len(found))
	for _, a := range found {
		accounts = append(accounts, map[string]any{
			"name": a.User.Name, "email": a.User.Email,
			"member_code": a.User.MemberCode, "ticket_number": a.User.TicketNumber,
			"reset_token": a.ResetToken,
		})
	}
	respondJSON(w, http.StatusOK, map[string]any{"accounts": accounts})
}

func (s *Server) handleResetPassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ResetToken string `json:"reset_token"`
		Password   string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondDecodeError(w, err, "invalid data format")
		return
	}
	if err := s.auth.ResetPassword(r.Context(), req.ResetToken, req.Password); err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "password reset"})
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
	type companyDTO struct {
		Name    string `json:"name"`
		LogoURL string `json:"logo_url"`
	}
	type tenantDTO struct {
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
		Visited     bool   `json:"visited"`
		// Everyone exhibiting on this stand. Almost always one entry that
		// mirrors the card; two where a stand is shared. The card reads this
		// rather than the tenant's own name and logo, so a shared stand shows
		// both marks instead of one company's above two companies' names.
		Companies []companyDTO `json:"companies"`
	}
	out := make([]tenantDTO, 0, len(tenants))
	for _, t := range tenants {
		companies := make([]companyDTO, 0, len(t.Companies))
		for _, c := range t.Companies {
			companies = append(companies, companyDTO{Name: c.Name, LogoURL: c.LogoURL})
		}
		out = append(out, tenantDTO{
			ID: t.ID, Name: t.Name, Category: t.Category,
			Booth: t.Booth, Initials: t.Initials, Kind: t.Kind,
			Description: t.Description, LogoURL: t.LogoURL,
			ContactName: t.ContactName, Chapter: t.Chapter,
			Visited: t.Visited, Companies: companies,
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
	type speakerDTO struct {
		Name     string `json:"name"`
		Role     string `json:"role"`
		Title    string `json:"title"`
		PhotoURL string `json:"photo_url"`
	}
	type seminarDTO struct {
		ID          int64  `json:"id"`
		Slot        int    `json:"slot"`
		Room        string `json:"room"`
		Title       string `json:"title"`
		Speaker     string `json:"speaker"`
		Moderator   string `json:"moderator"`
		Capacity    int    `json:"capacity"`
		SeatsLeft   int    `json:"seats_left"`
		Registered  bool   `json:"registered"`
		Attended    bool   `json:"attended"`
		Description string `json:"description"`
		CoverURL    string `json:"cover_url"`
		PosterURL   string `json:"poster_url"`
		StartsAt    string `json:"starts_at,omitempty"`
		EndsAt      string `json:"ends_at,omitempty"`

		Speakers []speakerDTO `json:"speakers"`
	}
	out := make([]seminarDTO, 0, len(seminars))
	for _, sem := range seminars {
		people := make([]speakerDTO, 0, len(sem.Speakers))
		for _, sp := range sem.Speakers {
			people = append(people, speakerDTO{
				Name: sp.Name, Role: sp.Role, Title: sp.Title, PhotoURL: sp.PhotoURL,
			})
		}
		out = append(out, seminarDTO{
			ID: sem.ID, Slot: sem.Slot, Room: sem.Room, Title: sem.Title,
			Speaker: sem.Speaker, Moderator: sem.Moderator, Capacity: sem.Capacity,
			SeatsLeft: sem.Capacity - sem.SeatsTaken, Registered: sem.Registered,
			Attended: sem.Attended, Description: sem.Description, CoverURL: sem.CoverURL,
			PosterURL: sem.PosterURL,
			StartsAt:  mustStart(sem.StartsAt, sem.EndsAt), EndsAt: mustEnd(sem.StartsAt, sem.EndsAt),
			Speakers: people,
		})
	}
	respondJSON(w, http.StatusOK, map[string]any{"seminars": out})
}

func (s *Server) handleRegisterSeminar(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		respondError(w, http.StatusBadRequest, "unknown seminar")
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
		respondError(w, http.StatusBadRequest, "unknown seminar")
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
		respondDecodeError(w, err, "member code is required")
		return
	}
	result, err := s.scan.Scan(r.Context(), userIDFrom(r.Context()), req.MemberCode)
	if err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]any{
		"member_id":      result.MemberID,
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
		"kind": booth.Kind, "description": booth.Description,
		"logo_url":     booth.LogoURL,
		"contact_name": booth.ContactName, "chapter": booth.Chapter,
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
	out := make([]map[string]any, 0, len(visitors))
	for _, v := range visitors {
		out = append(out, visitorToDTO(&v))
	}
	respondJSON(w, http.StatusOK, map[string]any{"visitors": out})
}

// The phone number is deliberately absent. A scan is somebody agreeing to be
// counted at a stand, not handing over their WhatsApp; the committee's own
// export is where a booth's follow-up list comes from, and the per-tenant one
// leaves the number out too. Withheld here rather than merely hidden in the
// app, so it never reaches the device at all.
func visitorToDTO(v *domain.Visitor) map[string]any {
	return map[string]any{
		"member_id":   v.MemberID,
		"name":        v.Name,
		"chapter":     v.Chapter,
		"company":     v.Company,
		"member_code": v.MemberCode,
		"note":        v.Note,
		"visited_at":  v.VisitedAt,
	}
}

func (s *Server) handleVisitorDetail(w http.ResponseWriter, r *http.Request) {
	memberID, err := strconv.ParseInt(chi.URLParam(r, "memberID"), 10, 64)
	if err != nil {
		respondError(w, http.StatusBadRequest, "unknown visitor")
		return
	}
	v, err := s.booth.VisitorDetail(r.Context(), userIDFrom(r.Context()), memberID)
	if err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]any{"visitor": visitorToDTO(v)})
}

func (s *Server) handleVisitorNote(w http.ResponseWriter, r *http.Request) {
	memberID, err := strconv.ParseInt(chi.URLParam(r, "memberID"), 10, 64)
	if err != nil {
		respondError(w, http.StatusBadRequest, "unknown visitor")
		return
	}
	var req struct {
		Note string `json:"note"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondDecodeError(w, err, "invalid data format")
		return
	}
	if err := s.booth.SetVisitorNote(r.Context(), userIDFrom(r.Context()), memberID, req.Note); err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "saved"})
}

// handleSeminarAttendees answers "who else is in this room". Names, chapters
// and companies only — no contact details.
func (s *Server) handleSeminarAttendees(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		respondError(w, http.StatusBadRequest, "unknown class")
		return
	}
	people, err := s.seminar.Attendees(r.Context(), id)
	if err != nil {
		respondDomainError(w, err)
		return
	}
	out := make([]map[string]any, 0, len(people))
	for _, a := range people {
		out = append(out, map[string]any{
			"name":       a.Name,
			"chapter":    a.Chapter,
			"company":    a.Company,
			"checked_in": a.CheckedIn,
		})
	}
	respondJSON(w, http.StatusOK, map[string]any{"attendees": out})
}

// Small helpers so the DTO stays a literal.
func mustStart(a, b *time.Time) string { s, _ := classTimes(a, b); return s }
func mustEnd(a, b *time.Time) string   { _, e := classTimes(a, b); return e }
