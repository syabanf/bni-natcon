package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"natcon2026/backend/internal/domain"
)

func isUniqueViolation(err error, constraint string) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505" &&
		(constraint == "" || pgErr.ConstraintName == constraint)
}

/* ----- Members ----- */

func (r *AdminRepo) ListMembers(ctx context.Context) ([]domain.MemberSummary, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT u.id, u.name, u.email, u.role, COALESCE(u.member_code, ''), u.chapter, u.company, u.created_at,
		       (SELECT COUNT(*) FROM visits v WHERE v.member_id = u.id)
		FROM users u
		WHERE u.role = 'member'
		ORDER BY u.name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domain.MemberSummary
	for rows.Next() {
		var m domain.MemberSummary
		if err := rows.Scan(&m.ID, &m.Name, &m.Email, &m.Role, &m.MemberCode,
			&m.Chapter, &m.Company, &m.CreatedAt, &m.Visits); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (r *AdminRepo) CreateMember(ctx context.Context, m domain.NewMember) (*domain.User, error) {
	var u domain.User
	err := r.pool.QueryRow(ctx, `
		INSERT INTO users (name, email, password_hash, role, member_code, chapter, company)
		VALUES ($1, $2, $3, 'member',
		        'NATCON-2026-' || lpad(nextval('member_code_seq')::text, 5, '0'),
		        $4, $5)
		RETURNING id, name, email, role, member_code, chapter, company, created_at`,
		m.Name, m.Email, m.PasswordHash, m.Chapter, m.Company).
		Scan(&u.ID, &u.Name, &u.Email, &u.Role, &u.MemberCode, &u.Chapter, &u.Company, &u.CreatedAt)
	if err != nil {
		if isUniqueViolation(err, "users_email_key") {
			return nil, domain.ErrEmailTaken
		}
		return nil, err
	}
	return &u, nil
}

func (r *AdminRepo) UpdateMember(ctx context.Context, id int64, m domain.MemberUpdate) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE users SET name = $1, email = $2, chapter = $3, company = $4
		WHERE id = $5 AND role = 'member'`,
		m.Name, m.Email, m.Chapter, m.Company, id)
	if err != nil {
		if isUniqueViolation(err, "users_email_key") {
			return domain.ErrEmailTaken
		}
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *AdminRepo) DeleteMember(ctx context.Context, id int64) error {
	tag, err := r.pool.Exec(ctx,
		`DELETE FROM users WHERE id = $1 AND role = 'member'`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

/* ----- Tenants ----- */

func (r *AdminRepo) CreateTenant(ctx context.Context, t domain.NewTenant) (*domain.Tenant, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var ownerID int64
	err = tx.QueryRow(ctx, `
		INSERT INTO users (name, email, password_hash, role, company)
		VALUES ($1, $2, $3, 'tenant', $1)
		RETURNING id`,
		t.Name, t.Email, t.PasswordHash).Scan(&ownerID)
	if err != nil {
		if isUniqueViolation(err, "users_email_key") {
			return nil, domain.ErrEmailTaken
		}
		return nil, err
	}

	var tenant domain.Tenant
	err = tx.QueryRow(ctx, `
		INSERT INTO tenants (name, category, booth, initials, owner_user_id)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, name, category, booth, initials, owner_user_id`,
		t.Name, t.Category, t.Booth, t.Initials, ownerID).
		Scan(&tenant.ID, &tenant.Name, &tenant.Category, &tenant.Booth, &tenant.Initials, &tenant.OwnerUserID)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &tenant, nil
}

func (r *AdminRepo) UpdateTenant(ctx context.Context, id int64, t domain.TenantUpdate) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE tenants SET name = $1, category = $2, booth = $3, initials = $4
		WHERE id = $5`,
		t.Name, t.Category, t.Booth, t.Initials, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	// Keep the booth login's display name in sync.
	_, err = r.pool.Exec(ctx, `
		UPDATE users SET name = $1, company = $1
		WHERE id = (SELECT owner_user_id FROM tenants WHERE id = $2)`,
		t.Name, id)
	return err
}

func (r *AdminRepo) DeleteTenant(ctx context.Context, id int64) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var ownerID int64
	err = tx.QueryRow(ctx,
		`DELETE FROM tenants WHERE id = $1 RETURNING owner_user_id`, id).Scan(&ownerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ErrNotFound
		}
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM users WHERE id = $1`, ownerID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

/* ----- Seminars ----- */

func (r *AdminRepo) CreateSeminar(ctx context.Context, s domain.SeminarInput) (*domain.Seminar, error) {
	var sem domain.Seminar
	err := r.pool.QueryRow(ctx, `
		INSERT INTO seminars (slot, room, title, speaker, capacity)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, slot, room, title, speaker, capacity`,
		s.Slot, s.Room, s.Title, s.Speaker, s.Capacity).
		Scan(&sem.ID, &sem.Slot, &sem.Room, &sem.Title, &sem.Speaker, &sem.Capacity)
	if err != nil {
		return nil, err
	}
	return &sem, nil
}

func (r *AdminRepo) UpdateSeminar(ctx context.Context, id int64, s domain.SeminarInput) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE seminars SET slot = $1, room = $2, title = $3, speaker = $4, capacity = $5
		WHERE id = $6`,
		s.Slot, s.Room, s.Title, s.Speaker, s.Capacity, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *AdminRepo) VisitReport(ctx context.Context) ([]domain.VisitReportRow, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT u.name, COALESCE(u.member_code, ''), u.chapter, u.company,
		       t.name, t.booth, v.created_at
		FROM visits v
		JOIN users u ON u.id = v.member_id
		JOIN tenants t ON t.id = v.tenant_id
		ORDER BY v.created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domain.VisitReportRow
	for rows.Next() {
		var v domain.VisitReportRow
		if err := rows.Scan(&v.MemberName, &v.MemberCode, &v.Chapter, &v.Company,
			&v.TenantName, &v.Booth, &v.VisitedAt); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

func (r *AdminRepo) RegistrationReport(ctx context.Context) ([]domain.RegistrationReportRow, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT u.name, COALESCE(u.member_code, ''), u.chapter,
		       s.slot, s.room, s.title, sr.created_at
		FROM seminar_registrations sr
		JOIN users u ON u.id = sr.member_id
		JOIN seminars s ON s.id = sr.seminar_id
		ORDER BY s.slot, s.room, sr.created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domain.RegistrationReportRow
	for rows.Next() {
		var v domain.RegistrationReportRow
		if err := rows.Scan(&v.MemberName, &v.MemberCode, &v.Chapter,
			&v.Slot, &v.Room, &v.SeminarTitle, &v.RegisteredAt); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

func (r *AdminRepo) DeleteSeminar(ctx context.Context, id int64) error {
	tag, err := r.pool.Exec(ctx, `DELETE FROM seminars WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}
