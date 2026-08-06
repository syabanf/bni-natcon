package postgres

import (
	"context"
	"database/sql"
	"errors"

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

const userColumns = `id, name, email, password_hash, role, COALESCE(member_code, ''), chapter, company, phone, classification, created_at`

func (r *UserRepo) scanUser(row pgx.Row) (*domain.User, error) {
	var u domain.User
	err := row.Scan(&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.Role, &u.MemberCode, &u.Chapter, &u.Company, &u.Phone, &u.Classification, &u.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) || errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return &u, nil
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
