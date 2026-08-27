package postgres

import (
	"context"
	"sync/atomic"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// AuthFailureRepo counts failed sign-in attempts across the whole fleet.
//
// Behind a load balancer the API is several processes, so a counter held in
// one process's memory is not the limit anybody intended: three instances
// would allow three times the guesses. The database is what they share.
// sweepEvery is how many recorded failures pass between clean-ups.
const sweepEvery = 200

type AuthFailureRepo struct {
	pool       *pgxpool.Pool
	sinceSweep atomic.Uint64
}

func NewAuthFailureRepo(pool *pgxpool.Pool) *AuthFailureRepo {
	return &AuthFailureRepo{pool: pool}
}

// RecentFailures counts wrong answers for one account inside the window.
func (r *AuthFailureRepo) RecentFailures(ctx context.Context, key string, window time.Duration) (int, error) {
	var n int
	err := r.pool.QueryRow(ctx, `
		SELECT count(*) FROM auth_failures
		WHERE key = $1 AND failed_at > now() - $2::interval`,
		key, window.String()).Scan(&n)
	return n, err
}

// RecordFailure notes one wrong answer.
//
// Every so often it also clears out rows that have aged past any window worth
// asking about. The sweep rides along with a write rather than a timer, so an
// idle API does no work at all, and it is only every sweepEvery-th failure
// because the insert is the part that has to be quick — the tidying can wait
// for the next wrong password.
func (r *AuthFailureRepo) RecordFailure(ctx context.Context, key string) error {
	if _, err := r.pool.Exec(ctx,
		`INSERT INTO auth_failures (key) VALUES ($1)`, key); err != nil {
		return err
	}
	if r.sinceSweep.Add(1)%sweepEvery != 0 {
		return nil
	}
	// Housekeeping: a row left behind is counted by nothing, so a failure
	// here is not worth failing a sign-in over.
	_, _ = r.pool.Exec(ctx,
		`DELETE FROM auth_failures WHERE failed_at < now() - interval '1 hour'`)
	return nil
}
