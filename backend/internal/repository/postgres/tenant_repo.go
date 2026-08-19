package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"natcon2026/backend/internal/domain"
)

type TenantRepo struct {
	pool *pgxpool.Pool
}

func NewTenantRepo(pool *pgxpool.Pool) *TenantRepo {
	return &TenantRepo{pool: pool}
}

func (r *TenantRepo) ListWithVisits(ctx context.Context, memberID int64) ([]domain.TenantWithVisit, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT t.id, t.name, t.category, t.booth, t.initials, t.kind, t.description,
		       t.logo_url, t.contact_name, t.chapter, t.owner_user_id,
		       (v.id IS NOT NULL) AS visited
		FROM tenants t
		LEFT JOIN visits v ON v.tenant_id = t.id AND v.member_id = $1
		ORDER BY (t.kind <> 'sponsor'), t.booth`, memberID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domain.TenantWithVisit
	for rows.Next() {
		var t domain.TenantWithVisit
		if err := rows.Scan(&t.ID, &t.Name, &t.Category, &t.Booth, &t.Initials, &t.Kind, &t.Description,
			&t.LogoURL, &t.ContactName, &t.Chapter, &t.OwnerUserID, &t.Visited); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (r *TenantRepo) GetByOwnerUserID(ctx context.Context, ownerUserID int64) (*domain.Tenant, error) {
	var t domain.Tenant
	err := r.pool.QueryRow(ctx, `
		SELECT id, name, category, booth, initials, kind, description,
		       logo_url, contact_name, chapter, owner_user_id
		FROM tenants WHERE owner_user_id = $1`, ownerUserID).
		Scan(&t.ID, &t.Name, &t.Category, &t.Booth, &t.Initials, &t.Kind, &t.Description,
			&t.LogoURL, &t.ContactName, &t.Chapter, &t.OwnerUserID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return &t, nil
}

func (r *TenantRepo) Count(ctx context.Context) (int, error) {
	var n int
	err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM tenants`).Scan(&n)
	return n, err
}
