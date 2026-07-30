package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"natcon2026/backend/internal/domain"
)

type VisitRepo struct {
	pool *pgxpool.Pool
}

func NewVisitRepo(pool *pgxpool.Pool) *VisitRepo {
	return &VisitRepo{pool: pool}
}

func (r *VisitRepo) Create(ctx context.Context, tenantID, memberID int64) (*domain.Visit, error) {
	var v domain.Visit
	err := r.pool.QueryRow(ctx, `
		INSERT INTO visits (tenant_id, member_id) VALUES ($1, $2)
		RETURNING id, tenant_id, member_id, created_at`, tenantID, memberID).
		Scan(&v.ID, &v.TenantID, &v.MemberID, &v.CreatedAt)
	if err != nil {
		var pgErr *pgconn.PgError
		// 23505 = unique_violation: this member was already scanned here.
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, domain.ErrDuplicateVisit
		}
		return nil, err
	}
	return &v, nil
}

func (r *VisitRepo) CountByMember(ctx context.Context, memberID int64) (int, error) {
	var n int
	err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM visits WHERE member_id = $1`, memberID).Scan(&n)
	return n, err
}

func (r *VisitRepo) StatsByTenant(ctx context.Context, tenantID int64) (*domain.BoothStats, error) {
	var s domain.BoothStats
	err := r.pool.QueryRow(ctx, `
		SELECT COUNT(*),
		       COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE)
		FROM visits WHERE tenant_id = $1`, tenantID).
		Scan(&s.TotalScans, &s.ScansToday)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

const visitorColumns = `u.id, u.name, u.chapter, u.company, COALESCE(u.member_code, ''), u.phone, v.note, v.created_at`

func (r *VisitRepo) RecentVisitors(ctx context.Context, tenantID int64, limit int) ([]domain.Visitor, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT `+visitorColumns+`
		FROM visits v
		JOIN users u ON u.id = v.member_id
		WHERE v.tenant_id = $1
		ORDER BY v.created_at DESC
		LIMIT $2`, tenantID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domain.Visitor
	for rows.Next() {
		var v domain.Visitor
		if err := rows.Scan(&v.MemberID, &v.Name, &v.Chapter, &v.Company, &v.MemberCode, &v.Phone, &v.Note, &v.VisitedAt); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

func (r *VisitRepo) SetNote(ctx context.Context, tenantID, memberID int64, note string) error {
	tag, err := r.pool.Exec(ctx,
		`UPDATE visits SET note = $3 WHERE tenant_id = $1 AND member_id = $2`,
		tenantID, memberID, note)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *VisitRepo) VisitorDetail(ctx context.Context, tenantID, memberID int64) (*domain.Visitor, error) {
	var v domain.Visitor
	err := r.pool.QueryRow(ctx, `
		SELECT `+visitorColumns+`
		FROM visits v
		JOIN users u ON u.id = v.member_id
		WHERE v.tenant_id = $1 AND v.member_id = $2`, tenantID, memberID).
		Scan(&v.MemberID, &v.Name, &v.Chapter, &v.Company, &v.MemberCode, &v.Phone, &v.Note, &v.VisitedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return &v, nil
}
