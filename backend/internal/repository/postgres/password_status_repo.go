package postgres

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"natcon2026/backend/internal/domain"
)

// PasswordStatusRepo answers one question the committee asks all morning:
// who is still signing in with the password we handed out?
//
// Everybody starts on the same one, so an account nobody has signed into yet
// is an account anybody holding the briefing sheet can sign into. The
// dashboard shows the totals; this is the list behind them.
type PasswordStatusRepo struct{ pool *pgxpool.Pool }

func NewPasswordStatusRepo(pool *pgxpool.Pool) *PasswordStatusRepo {
	return &PasswordStatusRepo{pool: pool}
}

// A booth's row is labelled with its stand, an attendee's with their chapter:
// whichever one the committee would use to find that person in the hall.
const passwordStatusFrom = `
	FROM users u
	LEFT JOIN tenants t ON t.owner_user_id = u.id
	WHERE u.role IN ('member', 'tenant')`

const passwordStatusFilter = `
	  AND ($1 = '' OR u.name ILIKE '%' || $1 || '%'
	                OR u.email ILIKE '%' || $1 || '%'
	                OR COALESCE(u.member_code, '') ILIKE '%' || $1 || '%'
	                OR COALESCE(u.chapter, '') ILIKE '%' || $1 || '%'
	                OR COALESCE(t.booth, '') ILIKE '%' || $1 || '%')
	  AND ($2 = 'all'
	       OR ($2 = 'pending' AND u.must_set_password)
	       OR ($2 = 'done' AND NOT u.must_set_password))`

func (r *PasswordStatusRepo) Summary(ctx context.Context) (domain.PasswordStatusSummary, error) {
	var s domain.PasswordStatusSummary
	err := r.pool.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE role = 'member'),
			COUNT(*) FILTER (WHERE role = 'member' AND NOT must_set_password),
			COUNT(*) FILTER (WHERE role = 'tenant'),
			COUNT(*) FILTER (WHERE role = 'tenant' AND NOT must_set_password)
		FROM users`).
		Scan(&s.MembersTotal, &s.MembersDone, &s.TenantsTotal, &s.TenantsDone)
	return s, err
}

// List returns one page, the accounts still on the handed-out password first:
// those are the ones the committee can still do something about.
func (r *PasswordStatusRepo) List(ctx context.Context, q, status string, limit, offset int) ([]domain.PasswordStatusRow, int, error) {
	var total int
	if err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*)`+passwordStatusFrom+passwordStatusFilter, q, status).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := r.pool.Query(ctx, `
		SELECT u.id, u.name, u.email, u.role,
		       COALESCE(NULLIF(t.booth, ''), COALESCE(u.chapter, '')),
		       COALESCE(u.member_code, ''),
		       NOT u.must_set_password`+
		passwordStatusFrom+passwordStatusFilter+`
		ORDER BY u.must_set_password DESC, u.role, lower(u.name)
		LIMIT $3 OFFSET $4`, q, status, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	out := make([]domain.PasswordStatusRow, 0, limit)
	for rows.Next() {
		var x domain.PasswordStatusRow
		if err := rows.Scan(&x.ID, &x.Name, &x.Email, &x.Role, &x.Label, &x.MemberCode, &x.Changed); err != nil {
			return nil, 0, err
		}
		out = append(out, x)
	}
	return out, total, rows.Err()
}
