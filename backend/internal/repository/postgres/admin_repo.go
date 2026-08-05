package postgres

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"natcon2026/backend/internal/domain"
)

type AdminRepo struct {
	pool *pgxpool.Pool
}

func NewAdminRepo(pool *pgxpool.Pool) *AdminRepo {
	return &AdminRepo{pool: pool}
}

func (r *AdminRepo) Overview(ctx context.Context) (*domain.AdminOverview, error) {
	var o domain.AdminOverview
	err := r.pool.QueryRow(ctx, `
		SELECT
			(SELECT COUNT(*) FROM users WHERE role = 'member'),
			(SELECT COUNT(*) FROM tenants),
			(SELECT COUNT(*) FROM tenants WHERE kind = 'sponsor'),
			(SELECT COUNT(*) FROM tenants WHERE kind <> 'sponsor'),
			(SELECT COUNT(*) FROM visits),
			(SELECT COUNT(*) FROM visits WHERE created_at::date = CURRENT_DATE),
			(SELECT COUNT(*) FROM seminar_registrations),
			(SELECT COUNT(DISTINCT member_id) FROM visits)`).
		Scan(&o.TotalMembers, &o.TotalTenants, &o.TotalSponsors, &o.TotalBooths,
			&o.TotalVisits, &o.VisitsToday,
			&o.SeminarRegistrations, &o.MembersWithVisit)
	if err != nil {
		return nil, err
	}
	return &o, nil
}

func (r *AdminRepo) TenantRanking(ctx context.Context) ([]domain.TenantScanCount, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT t.id, t.name, t.category, t.booth, t.initials, t.kind, t.description, t.owner_user_id,
		       COUNT(v.id) AS scans
		FROM tenants t
		LEFT JOIN visits v ON v.tenant_id = t.id
		GROUP BY t.id
		ORDER BY scans DESC, t.booth`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domain.TenantScanCount
	for rows.Next() {
		var t domain.TenantScanCount
		if err := rows.Scan(&t.ID, &t.Name, &t.Category, &t.Booth, &t.Initials, &t.Kind, &t.Description, &t.OwnerUserID, &t.ScanCount); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (r *AdminRepo) SeminarFill(ctx context.Context) ([]domain.SeminarFill, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT s.id, s.slot, s.room, s.title, s.speaker, s.capacity,
		       (SELECT COUNT(*) FROM seminar_registrations sr WHERE sr.seminar_id = s.id)
		FROM seminars s
		ORDER BY s.slot, s.room`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domain.SeminarFill
	for rows.Next() {
		var s domain.SeminarFill
		if err := rows.Scan(&s.ID, &s.Slot, &s.Room, &s.Title, &s.Speaker, &s.Capacity, &s.SeatsTaken); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func (r *AdminRepo) RecentActivity(ctx context.Context, limit int) ([]domain.ActivityItem, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT u.name, u.chapter, t.name, t.booth, v.created_at
		FROM visits v
		JOIN users u ON u.id = v.member_id
		JOIN tenants t ON t.id = v.tenant_id
		ORDER BY v.created_at DESC
		LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domain.ActivityItem
	for rows.Next() {
		var a domain.ActivityItem
		if err := rows.Scan(&a.MemberName, &a.Chapter, &a.TenantName, &a.Booth, &a.VisitedAt); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}
