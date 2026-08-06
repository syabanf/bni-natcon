package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"natcon2026/backend/internal/domain"
)

type SeminarRepo struct {
	pool *pgxpool.Pool
}

func NewSeminarRepo(pool *pgxpool.Pool) *SeminarRepo {
	return &SeminarRepo{pool: pool}
}

func (r *SeminarRepo) ListWithStatus(ctx context.Context, memberID int64) ([]domain.SeminarWithStatus, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT s.id, s.slot, s.room, s.title, s.speaker, s.moderator, s.capacity, s.description, s.cover_url,
		       (SELECT COUNT(*) FROM seminar_registrations sr WHERE sr.seminar_id = s.id) AS taken,
		       EXISTS (SELECT 1 FROM seminar_registrations sr WHERE sr.seminar_id = s.id AND sr.member_id = $1) AS registered,
		       EXISTS (SELECT 1 FROM seminar_attendance sa WHERE sa.seminar_id = s.id AND sa.member_id = $1) AS attended
		FROM seminars s
		ORDER BY s.slot, s.room`, memberID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domain.SeminarWithStatus
	for rows.Next() {
		var s domain.SeminarWithStatus
		if err := rows.Scan(&s.ID, &s.Slot, &s.Room, &s.Title, &s.Speaker, &s.Moderator, &s.Capacity, &s.Description, &s.CoverURL, &s.SeatsTaken, &s.Registered, &s.Attended); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func (r *SeminarRepo) Register(ctx context.Context, seminarID, memberID int64) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	// Lock the seminar row so concurrent registrations serialize on capacity.
	var slot, capacity int
	err = tx.QueryRow(ctx,
		`SELECT slot, capacity FROM seminars WHERE id = $1 FOR UPDATE`, seminarID).
		Scan(&slot, &capacity)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ErrNotFound
		}
		return err
	}

	var alreadyInSlot bool
	err = tx.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM seminar_registrations sr
			JOIN seminars s ON s.id = sr.seminar_id
			WHERE sr.member_id = $1 AND s.slot = $2
		)`, memberID, slot).Scan(&alreadyInSlot)
	if err != nil {
		return err
	}
	if alreadyInSlot {
		return domain.ErrAlreadyRegistered
	}

	var taken int
	if err := tx.QueryRow(ctx,
		`SELECT COUNT(*) FROM seminar_registrations WHERE seminar_id = $1`, seminarID).Scan(&taken); err != nil {
		return err
	}
	if taken >= capacity {
		return domain.ErrSeminarFull
	}

	if _, err := tx.Exec(ctx,
		`INSERT INTO seminar_registrations (seminar_id, member_id) VALUES ($1, $2)`, seminarID, memberID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *SeminarRepo) Unregister(ctx context.Context, seminarID, memberID int64) error {
	tag, err := r.pool.Exec(ctx,
		`DELETE FROM seminar_registrations WHERE seminar_id = $1 AND member_id = $2`,
		seminarID, memberID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *SeminarRepo) CountRegistrationsByMember(ctx context.Context, memberID int64) (int, error) {
	var n int
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM seminar_registrations WHERE member_id = $1`, memberID).Scan(&n)
	return n, err
}

func (r *SeminarRepo) CountSlots(ctx context.Context) (int, error) {
	var n int
	err := r.pool.QueryRow(ctx, `SELECT COUNT(DISTINCT slot) FROM seminars`).Scan(&n)
	return n, err
}
