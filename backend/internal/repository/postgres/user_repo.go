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

const userColumns = `id, name, email, password_hash, role, COALESCE(member_code, ''), chapter, company, phone, classification, must_set_password, ticket_number, consented_at, pin_redeemed_at, goodiebag_redeemed_at, created_at`

func (r *UserRepo) scanUser(row pgx.Row) (*domain.User, error) {
	var u domain.User
	err := row.Scan(&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.Role, &u.MemberCode, &u.Chapter, &u.Company, &u.Phone, &u.Classification, &u.MustSetPassword,
		&u.TicketNumber, &u.ConsentedAt, &u.PinRedeemedAt, &u.GoodiebagRedeemedAt, &u.CreatedAt)
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
			&u.TicketNumber, &u.ConsentedAt, &u.PinRedeemedAt, &u.GoodiebagRedeemedAt, &u.CreatedAt); err != nil {
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

// The attendee's QR carries their ticket number, so that is what a scanner
// sees most of the day. The member code still works — it is printed on the
// pass, and attendees added by hand in the admin panel have no ticket.
const scanKeySQL = `(ticket_number <> '' AND ticket_number = $1)
		        OR member_code = $1
		        OR (phone <> '' AND phone = $1)`

func (r *UserRepo) GetByScanCode(ctx context.Context, key string) (*domain.User, error) {
	return r.scanUser(r.pool.QueryRow(ctx,
		`SELECT `+userColumns+` FROM users
		 WHERE role = 'member' AND (`+scanKeySQL+`)
		 LIMIT 1`, key))
}

// SetPassword stores a new hash and clears the "still on the generated
// password" flag.
// RecordConsent stamps when an attendee agreed to the data notice. COALESCE
// keeps the first answer: a second tick must not rewrite history about when
// they actually agreed.
func (r *UserRepo) RecordConsent(ctx context.Context, userID int64) error {
	tag, err := r.pool.Exec(ctx,
		`UPDATE users SET consented_at = COALESCE(consented_at, now()) WHERE id = $1`, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

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
			&u.TicketNumber, &u.ConsentedAt, &u.PinRedeemedAt, &u.GoodiebagRedeemedAt, &u.CreatedAt); err != nil {
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

// UpdateProfile lets an attendee correct their own name and chapter — the
// two lines printed on the pass they show all day. The chapter registers
// itself in the master list, the same rule the imports follow: the list is
// exactly what attendees carry.
func (r *UserRepo) UpdateProfile(ctx context.Context, userID int64, name, chapter string) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	if chapter != "" {
		// Register case-insensitively and take the master list's spelling,
		// so "amplify" typed on a phone lands on the existing "Amplify".
		if err := tx.QueryRow(ctx, `
			WITH ins AS (
				INSERT INTO chapters (name) VALUES ($1)
				ON CONFLICT ((lower(name))) DO NOTHING
				RETURNING name
			)
			SELECT name FROM ins
			UNION ALL
			SELECT name FROM chapters WHERE lower(name) = lower($1)
			LIMIT 1`, chapter).Scan(&chapter); err != nil {
			return err
		}
	}
	tag, err := tx.Exec(ctx,
		`UPDATE users SET name = $1, chapter = $2 WHERE id = $3 AND role = 'member'`,
		name, chapter, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return tx.Commit(ctx)
}

// ListChapterNames is the datalist behind the profile page's chapter field.
func (r *UserRepo) ListChapterNames(ctx context.Context) ([]string, error) {
	rows, err := r.pool.Query(ctx, `SELECT name FROM chapters ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err != nil {
			return nil, err
		}
		out = append(out, n)
	}
	return out, rows.Err()
}
