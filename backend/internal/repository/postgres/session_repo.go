package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"natcon2026/backend/internal/domain"
)

// The speed-networking round. One row per round, started and stopped by the
// committee, read by every attendee so they all see the same clock.

func (r *AdminRepo) CurrentSession(ctx context.Context) (*domain.NetworkingSession, error) {
	var s domain.NetworkingSession
	err := r.pool.QueryRow(ctx, `
		SELECT id, round, starts_at, ends_at, stopped_at
		FROM networking_sessions
		ORDER BY starts_at DESC
		LIMIT 1`).Scan(&s.ID, &s.Round, &s.StartsAt, &s.EndsAt, &s.StoppedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return &s, nil
}

// StartSession closes whatever is running and opens the next round in the
// same transaction, so there is never a moment with two live clocks.
func (r *AdminRepo) StartSession(ctx context.Context, minutes int) (*domain.NetworkingSession, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	if _, err := tx.Exec(ctx, `
		UPDATE networking_sessions SET stopped_at = now()
		WHERE stopped_at IS NULL AND ends_at > now()`); err != nil {
		return nil, err
	}

	var s domain.NetworkingSession
	if err := tx.QueryRow(ctx, `
		INSERT INTO networking_sessions (round, ends_at)
		VALUES ((SELECT COALESCE(MAX(round), 0) + 1 FROM networking_sessions),
		        now() + make_interval(mins => $1))
		RETURNING id, round, starts_at, ends_at, stopped_at`, minutes).
		Scan(&s.ID, &s.Round, &s.StartsAt, &s.EndsAt, &s.StoppedAt); err != nil {
		return nil, err
	}
	return &s, tx.Commit(ctx)
}

// StopSession ends the running round now. Stopping when nothing is running is
// not an error: the committee pressed stop, and nothing is running.
func (r *AdminRepo) StopSession(ctx context.Context) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE networking_sessions SET stopped_at = now()
		WHERE stopped_at IS NULL AND ends_at > now()`)
	return err
}

// ServerNow is sent alongside the round so a phone with a wrong clock still
// counts down the right number of seconds.
func (r *AdminRepo) ServerNow(ctx context.Context) (time.Time, error) {
	var now time.Time
	err := r.pool.QueryRow(ctx, `SELECT now()`).Scan(&now)
	return now, err
}
