package http

import (
	"encoding/json"
	"net/http"

	"natcon2026/backend/internal/domain"
	"natcon2026/backend/internal/usecase"
)

const maxImportRows = 1000

func bulkErrorsDTO(errs []domain.BulkRowError) []map[string]any {
	out := make([]map[string]any, 0, len(errs))
	for _, e := range errs {
		out = append(out, map[string]any{"row": e.Row, "label": e.Label, "error": e.Err})
	}
	return out
}

func (s *Server) handleAdminBulkMembers(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Members []struct {
			Name           string `json:"name"`
			Email          string `json:"email"`
			Chapter        string `json:"chapter"`
			Company        string `json:"company"`
			Phone          string `json:"phone"`
			Classification string `json:"classification"`
			TicketNumber   string `json:"ticket_number"`
		} `json:"members"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(req.Members) == 0 {
		respondError(w, http.StatusBadRequest, "member list is empty — check the import file")
		return
	}
	if len(req.Members) > maxImportRows {
		respondError(w, http.StatusBadRequest, "too many rows — maximum 1000 per import")
		return
	}
	rows := make([]usecase.MemberImportRow, 0, len(req.Members))
	for _, m := range req.Members {
		rows = append(rows, usecase.MemberImportRow{
			Name: m.Name, Email: m.Email, Chapter: m.Chapter, Company: m.Company,
			Phone: m.Phone, Classification: m.Classification, TicketNumber: m.TicketNumber,
		})
	}
	created, updated, errs := s.admin.BulkUpsertMembers(r.Context(), rows)
	respondJSON(w, http.StatusOK, map[string]any{
		"created": created,
		"updated": updated,
		"failed":  len(errs),
		"errors":  bulkErrorsDTO(errs),
	})
}

func (s *Server) handleAdminBulkTenants(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Tenants []struct {
			Name     string `json:"name"`
			Category string `json:"category"`
			Booth    string `json:"booth"`
			Initials string `json:"initials"`
			Email    string `json:"email"`
			Kind     string `json:"kind"`
			Desc     string `json:"description"`
		} `json:"tenants"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(req.Tenants) == 0 {
		respondError(w, http.StatusBadRequest, "tenant list is empty — check the import file")
		return
	}
	if len(req.Tenants) > maxImportRows {
		respondError(w, http.StatusBadRequest, "too many rows — maximum 1000 per import")
		return
	}
	rows := make([]usecase.TenantImportRow, 0, len(req.Tenants))
	for _, t := range req.Tenants {
		rows = append(rows, usecase.TenantImportRow{
			Name: t.Name, Category: t.Category, Booth: t.Booth, Initials: t.Initials, Email: t.Email,
			Kind: t.Kind, Description: t.Desc,
		})
	}
	created, updated, errs := s.admin.BulkUpsertTenants(r.Context(), rows)
	respondJSON(w, http.StatusOK, map[string]any{
		"created": created,
		"updated": updated,
		"failed":  len(errs),
		"errors":  bulkErrorsDTO(errs),
	})
}

func (s *Server) handleAdminVisitReport(w http.ResponseWriter, r *http.Request) {
	report, err := s.admin.VisitReport(r.Context())
	if err != nil {
		respondDomainError(w, err)
		return
	}
	out := make([]map[string]any, 0, len(report))
	for _, v := range report {
		out = append(out, map[string]any{
			"member_name": v.MemberName,
			"member_code": v.MemberCode,
			"chapter":     v.Chapter,
			"company":     v.Company,
			"tenant_name": v.TenantName,
			"booth":       v.Booth,
			"visited_at":  v.VisitedAt,
		})
	}
	respondJSON(w, http.StatusOK, map[string]any{"visits": out})
}

func (s *Server) handleAdminRegistrationReport(w http.ResponseWriter, r *http.Request) {
	report, err := s.admin.RegistrationReport(r.Context())
	if err != nil {
		respondDomainError(w, err)
		return
	}
	out := make([]map[string]any, 0, len(report))
	for _, v := range report {
		out = append(out, map[string]any{
			"member_name":   v.MemberName,
			"member_code":   v.MemberCode,
			"chapter":       v.Chapter,
			"slot":          v.Slot,
			"room":          v.Room,
			"seminar_title": v.SeminarTitle,
			"registered_at": v.RegisteredAt,
			"attended":      v.Attended,
		})
	}
	respondJSON(w, http.StatusOK, map[string]any{"registrations": out})
}

func (s *Server) handleAdminBulkRegistrations(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Registrations []struct {
			Member string `json:"member"`
			Room   string `json:"room"`
		} `json:"registrations"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(req.Registrations) == 0 {
		respondError(w, http.StatusBadRequest, "registration list is empty — check the import file")
		return
	}
	if len(req.Registrations) > maxImportRows {
		respondError(w, http.StatusBadRequest, "too many rows — maximum 1000 per import")
		return
	}
	rows := make([]usecase.RegistrationImportRow, 0, len(req.Registrations))
	for _, x := range req.Registrations {
		rows = append(rows, usecase.RegistrationImportRow{Lookup: x.Member, Room: x.Room})
	}
	created, updated, errs := s.admin.BulkRegisterSeminar(r.Context(), rows)
	respondJSON(w, http.StatusOK, map[string]any{
		"created": created,
		"updated": updated,
		"failed":  len(errs),
		"errors":  bulkErrorsDTO(errs),
	})
}
