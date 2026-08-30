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

// The passport lists WIT.id first, then the sponsors, then the floor in booth
// order — the committee asked for that placement, the way sponsors already
// had it. It is a listing order and nothing else: it does not touch the scan
// leaderboard, which is a measurement rather than a placement.
//
// Matched case-insensitively: the committee's sheets have spelled it both
// 'WIT.id' and 'WIT.ID', and where it sits must not depend on which.
func (r *TenantRepo) ListWithVisits(ctx context.Context, memberID int64) ([]domain.TenantWithVisit, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT t.id, t.name, t.category, t.booth, t.initials, t.kind, t.description,
		       t.logo_url, t.contact_name, t.chapter, t.owner_user_id,
		       (v.id IS NOT NULL) AS visited
		FROM tenants t
		LEFT JOIN visits v ON v.tenant_id = t.id AND v.member_id = $1
		ORDER BY (lower(t.name) <> 'wit.id'), (t.kind <> 'sponsor'), t.booth`, memberID)
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
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// One query for every stand's companies rather than one per card: the
	// passport draws 36 of them at once.
	byTenant, err := loadTenantCompanies(ctx, r.pool)
	if err != nil {
		return nil, err
	}
	for i := range out {
		out[i].Companies = byTenant[out[i].ID]
	}
	return out, nil
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

// loadTenantCompanies reads every stand's exhibitors in display order.
//
// A stand almost always has exactly one, mirroring the tenant itself; C1 is
// shared by two companies. Returned as a map so a list of stands can be
// filled in without a query per card.
func loadTenantCompanies(ctx context.Context, pool *pgxpool.Pool) (map[int64][]domain.TenantCompany, error) {
	rows, err := pool.Query(ctx, `
		SELECT tenant_id, name, logo_url
		FROM tenant_companies
		ORDER BY tenant_id, sort, id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make(map[int64][]domain.TenantCompany)
	for rows.Next() {
		var id int64
		var c domain.TenantCompany
		if err := rows.Scan(&id, &c.Name, &c.LogoURL); err != nil {
			return nil, err
		}
		out[id] = append(out[id], c)
	}
	return out, rows.Err()
}
