package http

import (
	"context"
	"net/http"

	"natcon2026/backend/internal/domain"
)

// SponsorLister reads the sponsor wall. An interface rather than a usecase
// because there is no rule to apply: the wall is a list, in an order the
// repository already knows.
type SponsorLister interface {
	List(ctx context.Context) ([]domain.Sponsor, error)
}

// handleListSponsors returns the wall grouped for display — the apps render
// the groups in the order they arrive, so nobody has to reimplement "Diamond
// comes first" three times.
func (s *Server) handleListSponsors(w http.ResponseWriter, r *http.Request) {
	list, err := s.sponsors.List(r.Context())
	if err != nil {
		respondDomainError(w, err)
		return
	}

	groups := make([]map[string]any, 0, 3)
	var current map[string]any
	for _, sp := range list {
		if current == nil || current["tier"] != sp.Tier {
			current = map[string]any{
				"tier":     sp.Tier,
				"label":    domain.SponsorTierLabel(sp.Tier),
				"sponsors": []map[string]any{},
			}
			groups = append(groups, current)
		}
		current["sponsors"] = append(current["sponsors"].([]map[string]any), map[string]any{
			"id": sp.ID, "name": sp.Name, "logo_url": sp.LogoURL,
		})
	}
	respondJSON(w, http.StatusOK, map[string]any{"groups": groups})
}
