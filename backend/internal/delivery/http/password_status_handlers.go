package http

import (
	"context"
	"net/http"
	"strconv"

	"natcon2026/backend/internal/domain"
)

// PasswordStatusReader backs the committee's "who is still on our password"
// page. An interface rather than a usecase: there is no rule to apply, only a
// count and a list.
type PasswordStatusReader interface {
	Summary(ctx context.Context) (domain.PasswordStatusSummary, error)
	List(ctx context.Context, q, status string, limit, offset int) ([]domain.PasswordStatusRow, int, error)
}

// handleAdminPasswordStatus returns the summary and one page of accounts.
// Both in one response: the page shows them together, and two round trips to
// draw one screen is one more chance for the numbers to disagree.
func (s *Server) handleAdminPasswordStatus(w http.ResponseWriter, r *http.Request) {
	qs := r.URL.Query()
	status := qs.Get("status")
	if status != "pending" && status != "done" {
		status = "all"
	}
	page, _ := strconv.Atoi(qs.Get("page"))
	if page <= 0 {
		page = 1
	}
	limit, _ := strconv.Atoi(qs.Get("limit"))
	if limit <= 0 {
		limit = 50
	}
	if limit > 500 {
		limit = 500
	}

	summary, err := s.passwords.Summary(r.Context())
	if err != nil {
		respondDomainError(w, err)
		return
	}
	rows, total, err := s.passwords.List(r.Context(), qs.Get("q"), status, limit, (page-1)*limit)
	if err != nil {
		respondDomainError(w, err)
		return
	}

	out := make([]map[string]any, 0, len(rows))
	for _, x := range rows {
		out = append(out, map[string]any{
			"id": x.ID, "name": x.Name, "email": x.Email, "role": x.Role,
			"label": x.Label, "member_code": x.MemberCode, "changed": x.Changed,
		})
	}
	respondJSON(w, http.StatusOK, map[string]any{
		"summary": map[string]any{
			"members_total": summary.MembersTotal,
			"members_done":  summary.MembersDone,
			"tenants_total": summary.TenantsTotal,
			"tenants_done":  summary.TenantsDone,
		},
		"rows": out, "total": total, "page": page, "limit": limit, "status": status,
	})
}
