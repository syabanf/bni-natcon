package postgres

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"natcon2026/backend/internal/domain"
)

type SponsorRepo struct{ pool *pgxpool.Pool }

func NewSponsorRepo(pool *pgxpool.Pool) *SponsorRepo { return &SponsorRepo{pool: pool} }

// List returns the wall in the order it is displayed: Diamond, then Platinum,
// then the supporters, and within a tier the sequence the committee sent the
// artwork in. The ordering lives here rather than in the apps so the three
// front ends cannot drift apart on which sponsor comes first.
func (r *SponsorRepo) List(ctx context.Context) ([]domain.Sponsor, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, tier, name, logo_url
		FROM sponsors
		ORDER BY CASE tier
			WHEN 'diamond'  THEN 0
			WHEN 'platinum' THEN 1
			ELSE 2
		END, sort, lower(name)`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]domain.Sponsor, 0, 32)
	for rows.Next() {
		var s domain.Sponsor
		if err := rows.Scan(&s.ID, &s.Tier, &s.Name, &s.LogoURL); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}
