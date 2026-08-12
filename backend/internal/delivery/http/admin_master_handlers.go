package http

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"natcon2026/backend/internal/domain"
	"natcon2026/backend/internal/usecase"
)

func pathID(r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	return id, err == nil && id > 0
}

/* ----- Members ----- */

type memberPayload struct {
	Name           string `json:"name"`
	Email          string `json:"email"`
	Password       string `json:"password"`
	Chapter        string `json:"chapter"`
	Company        string `json:"company"`
	Phone          string `json:"phone"`
	Classification string `json:"classification"`
}

func (s *Server) handleAdminListMembers(w http.ResponseWriter, r *http.Request) {
	qs := r.URL.Query()
	page, _ := strconv.Atoi(qs.Get("page"))
	limit, _ := strconv.Atoi(qs.Get("limit"))
	members, total, err := s.admin.ListMembers(r.Context(), qs.Get("q"), page, limit)
	if err != nil {
		respondDomainError(w, err)
		return
	}
	if page <= 0 {
		page = 1
	}
	// Mirror the usecase clamp so the echoed limit matches what was served.
	if limit <= 0 {
		limit = 50
	}
	if limit > usecase.MaxMemberPageSize {
		limit = usecase.MaxMemberPageSize
	}
	type row struct {
		ID         int64  `json:"id"`
		Name       string `json:"name"`
		Email      string `json:"email"`
		MemberCode string `json:"member_code"`
		Chapter    string `json:"chapter"`
		Company    string `json:"company"`
		Phone      string `json:"phone"`

		Classification string `json:"classification"`
		Visits         int    `json:"visits"`
	}
	out := make([]row, 0, len(members))
	for _, m := range members {
		out = append(out, row{
			ID: m.ID, Name: m.Name, Email: m.Email, MemberCode: m.MemberCode,
			Chapter: m.Chapter, Company: m.Company, Phone: m.Phone,
			Classification: m.Classification, Visits: m.Visits,
		})
	}
	respondJSON(w, http.StatusOK, map[string]any{
		"members": out, "total": total, "page": page, "limit": limit,
	})
}

func (s *Server) handleAdminSeminarCheckin(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		respondError(w, http.StatusBadRequest, "unknown record")
		return
	}
	var req struct {
		MemberCode string `json:"member_code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid data format")
		return
	}
	res, err := s.admin.SeminarCheckin(r.Context(), id, req.MemberCode)
	if err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]any{
		"member_name":    res.MemberName,
		"member_code":    res.MemberCode,
		"member_chapter": res.MemberChapter,
		"duplicate":      res.Duplicate,
		"attended_count": res.AttendedCount,
	})
}

func (s *Server) handleAdminCreateMember(w http.ResponseWriter, r *http.Request) {
	var req memberPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid data format")
		return
	}
	user, err := s.admin.CreateMember(r.Context(), usecase.MemberInput{
		Name: req.Name, Email: req.Email, Password: req.Password, Chapter: req.Chapter,
		Company: req.Company, Phone: req.Phone, Classification: req.Classification,
	})
	if err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusCreated, map[string]any{"user": toUserDTO(user)})
}

func (s *Server) handleAdminUpdateMember(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		respondError(w, http.StatusBadRequest, "unknown record")
		return
	}
	var req memberPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid data format")
		return
	}
	err := s.admin.UpdateMember(r.Context(), id, domain.MemberUpdate{
		Name: req.Name, Email: req.Email, Chapter: req.Chapter, Company: req.Company,
		Phone: req.Phone, Classification: req.Classification,
	})
	if err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (s *Server) handleAdminDeleteMember(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		respondError(w, http.StatusBadRequest, "unknown record")
		return
	}
	if err := s.admin.DeleteMember(r.Context(), id); err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

/* ----- Tenants ----- */

type tenantPayload struct {
	Name        string `json:"name"`
	Category    string `json:"category"`
	Booth       string `json:"booth"`
	Initials    string `json:"initials"`
	Kind        string `json:"kind"`
	Description string `json:"description"`
	ContactName string `json:"contact_name"`
	Chapter     string `json:"chapter"`
	Email       string `json:"email"`
	Password    string `json:"password"`
}

func (s *Server) handleAdminCreateTenant(w http.ResponseWriter, r *http.Request) {
	var req tenantPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid data format")
		return
	}
	tenant, err := s.admin.CreateTenant(r.Context(), usecase.TenantInput{
		Name: req.Name, Category: req.Category, Booth: req.Booth, Initials: req.Initials,
		Kind: req.Kind, Description: req.Description, ContactName: req.ContactName,
		Chapter: req.Chapter, Email: req.Email, Password: req.Password,
	})
	if err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusCreated, map[string]any{
		"tenant": map[string]any{
			"id": tenant.ID, "name": tenant.Name, "category": tenant.Category,
			"booth": tenant.Booth, "initials": tenant.Initials,
			"kind": tenant.Kind, "description": tenant.Description,
			"contact_name": tenant.ContactName, "chapter": tenant.Chapter,
		},
	})
}

func (s *Server) handleAdminUpdateTenant(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		respondError(w, http.StatusBadRequest, "unknown record")
		return
	}
	var req tenantPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid data format")
		return
	}
	err := s.admin.UpdateTenant(r.Context(), id, domain.TenantUpdate{
		Name: req.Name, Category: req.Category, Booth: req.Booth, Initials: req.Initials,
		Kind: req.Kind, Description: req.Description,
		ContactName: req.ContactName, Chapter: req.Chapter,
	})
	if err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (s *Server) handleAdminDeleteTenant(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		respondError(w, http.StatusBadRequest, "unknown record")
		return
	}
	if err := s.admin.DeleteTenant(r.Context(), id); err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

/* ----- Seminars ----- */

type speakerPayload struct {
	Name     string `json:"name"`
	Role     string `json:"role"`
	Title    string `json:"title"`
	PhotoURL string `json:"photo_url"`
}

type seminarPayload struct {
	Slot        int    `json:"slot"`
	Room        string `json:"room"`
	Title       string `json:"title"`
	Speaker     string `json:"speaker"`
	Moderator   string `json:"moderator"`
	Capacity    int    `json:"capacity"`
	Description string `json:"description"`
	CoverURL    string `json:"cover_url"`

	Speakers []speakerPayload `json:"speakers"`
}

func (p seminarPayload) toInput() domain.SeminarInput {
	people := make([]domain.SeminarSpeaker, 0, len(p.Speakers))
	for _, sp := range p.Speakers {
		if strings.TrimSpace(sp.Name) == "" {
			continue
		}
		people = append(people, domain.SeminarSpeaker{
			Name: strings.TrimSpace(sp.Name), Role: sp.Role,
			Title: strings.TrimSpace(sp.Title), PhotoURL: sp.PhotoURL,
		})
	}
	return domain.SeminarInput{
		Slot: p.Slot, Room: p.Room, Title: p.Title, Speaker: p.Speaker,
		Moderator: p.Moderator, Capacity: p.Capacity,
		Description: p.Description, CoverURL: p.CoverURL, Speakers: people,
	}
}

func (s *Server) handleAdminCreateSeminar(w http.ResponseWriter, r *http.Request) {
	var req seminarPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid data format")
		return
	}
	sem, err := s.admin.CreateSeminar(r.Context(), req.toInput())
	if err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusCreated, map[string]any{
		"seminar": map[string]any{
			"id": sem.ID, "slot": sem.Slot, "room": sem.Room,
			"title": sem.Title, "speaker": sem.Speaker, "moderator": sem.Moderator,
			"capacity": sem.Capacity,
		},
	})
}

func (s *Server) handleAdminUpdateSeminar(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		respondError(w, http.StatusBadRequest, "unknown record")
		return
	}
	var req seminarPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid data format")
		return
	}
	if err := s.admin.UpdateSeminar(r.Context(), id, req.toInput()); err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

// handleAdminSetSeminarQuota takes either {"quota": n} or {"capacity": n} —
// the API has always called the field capacity, the committee calls it the
// quota, and neither should have to remember which.
func (s *Server) handleAdminSetSeminarQuota(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		respondError(w, http.StatusBadRequest, "unknown record")
		return
	}
	var req struct {
		Quota    *int `json:"quota"`
		Capacity *int `json:"capacity"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid data format")
		return
	}
	quota := req.Quota
	if quota == nil {
		quota = req.Capacity
	}
	if quota == nil {
		respondError(w, http.StatusBadRequest, "quota is required")
		return
	}
	res, err := s.admin.SetSeminarQuota(r.Context(), id, *quota)
	if err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]any{
		"seminar": map[string]any{
			"id":          res.ID,
			"capacity":    res.Capacity,
			"seats_taken": res.SeatsTaken,
			"seats_left":  res.Capacity - res.SeatsTaken,
		},
	})
}

func (s *Server) handleAdminDeleteSeminar(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		respondError(w, http.StatusBadRequest, "unknown record")
		return
	}
	if err := s.admin.DeleteSeminar(r.Context(), id); err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

/* ----- Class registrations made by the committee ----- */

func (s *Server) handleAdminRegisterSeminarMember(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		respondError(w, http.StatusBadRequest, "unknown record")
		return
	}
	var req struct {
		Member string `json:"member"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid data format")
		return
	}
	res, err := s.admin.RegisterSeminarMember(r.Context(), id, req.Member)
	if err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusCreated, map[string]any{
		"member_name":    res.MemberName,
		"member_code":    res.MemberCode,
		"member_chapter": res.MemberChapter,
		"duplicate":      res.Duplicate,
	})
}

func (s *Server) handleAdminUnregisterSeminarMember(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		respondError(w, http.StatusBadRequest, "unknown record")
		return
	}
	code := chi.URLParam(r, "code")
	if err := s.admin.UnregisterSeminarMember(r.Context(), id, code); err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "unregistered"})
}
