package postgres

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"natcon2026/backend/internal/domain"
)

type UserRepo struct {
	pool *pgxpool.Pool
}

func NewUserRepo(pool *pgxpool.Pool) *UserRepo {
	return &UserRepo{pool: pool}
}

const userColumns = `id, name, email, password_hash, role, COALESCE(member_code, ''), chapter, company, phone, classification, must_set_password, ticket_number, created_at`

func (r *UserRepo) scanUser(row pgx.Row) (*domain.User, error) {
	var u domain.User
	err := row.Scan(&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.Role, &u.MemberCode, &u.Chapter, &u.Company, &u.Phone, &u.Classification, &u.MustSetPassword,
		&u.TicketNumber, &u.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) || errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return &u, nil
}

// ListByEmail returns every account on an address. Members can share one
// (a buyer holding two tickets); tenant and admin addresses stay unique.
func (r *UserRepo) ListByEmail(ctx context.Context, email string) ([]*domain.User, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT `+userColumns+` FROM users WHERE email = $1 ORDER BY member_code, id`, email)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*domain.User
	for rows.Next() {
		var u domain.User
		if err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.Role, &u.MemberCode,
			&u.Chapter, &u.Company, &u.Phone, &u.Classification, &u.MustSetPassword,
			&u.TicketNumber, &u.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, &u)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(out) == 0 {
		return nil, domain.ErrNotFound
	}
	return out, nil
}

func (r *UserRepo) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
	return r.scanUser(r.pool.QueryRow(ctx,
		`SELECT `+userColumns+` FROM users WHERE email = $1`, email))
}

func (r *UserRepo) GetByID(ctx context.Context, id int64) (*domain.User, error) {
	return r.scanUser(r.pool.QueryRow(ctx,
		`SELECT `+userColumns+` FROM users WHERE id = $1`, id))
}

func (r *UserRepo) GetByMemberCode(ctx context.Context, code string) (*domain.User, error) {
	return r.scanUser(r.pool.QueryRow(ctx,
		`SELECT `+userColumns+` FROM users WHERE member_code = $1 AND role = 'member'`, code))
}

func (r *UserRepo) GetByCodeOrPhone(ctx context.Context, key string) (*domain.User, error) {
	return r.scanUser(r.pool.QueryRow(ctx,
		`SELECT `+userColumns+` FROM users
		 WHERE role = 'member' AND (member_code = $1 OR (phone <> '' AND phone = $1))
		 LIMIT 1`, key))
}

// SetPassword stores a new hash and clears the "still on the generated
// password" flag.
func (r *UserRepo) SetPassword(ctx context.Context, userID int64, hash string) error {
	tag, err := r.pool.Exec(ctx,
		`UPDATE users SET password_hash = $1, must_set_password = false WHERE id = $2`,
		hash, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

// FindMemberByChapterPhone backs password recovery: an attendee proves who
// they are with their chapter and the phone number on their ticket. The phone
// is compared on digits only, so +62…/08… forms all match, and the chapter
// match ignores case and spacing.
func (r *UserRepo) FindMembersByChapterPhone(ctx context.Context, chapter, phone string) ([]*domain.User, error) {
	digits := digitsOnly(phone)
	if len(digits) < 8 {
		return nil, domain.ErrNotFound
	}
	// Compare the last 9 digits: enough to be unique in practice, and immune
	// to the +62 / 62 / 0 prefix soup the ticketing export carries.
	tail := digits[len(digits)-9:]
	rows, err := r.pool.Query(ctx, `
		SELECT `+userColumns+` FROM users
		WHERE role = 'member'
		  AND lower(replace(chapter, ' ', '')) = lower(replace($1, ' ', ''))
		  AND right(regexp_replace(phone, '\D', '', 'g'), 9) = $2
		ORDER BY member_code, id`, chapter, tail)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*domain.User
	for rows.Next() {
		var u domain.User
		if err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.Role, &u.MemberCode,
			&u.Chapter, &u.Company, &u.Phone, &u.Classification, &u.MustSetPassword,
			&u.TicketNumber, &u.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, &u)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(out) == 0 {
		return nil, domain.ErrNotFound
	}
	return out, nil
}

func digitsOnly(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}
