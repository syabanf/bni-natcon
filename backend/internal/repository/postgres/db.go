package postgres

import (
	"context"
	"embed"
	"fmt"
	"log/slog"
	"sort"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

// NewPool opens the connection pool the whole API shares.
//
// The sizes are set here rather than left to pgx's defaults, which are
// max(4, NumCPU) connections and none kept warm. On a two-core VPS — the
// shape most of these events get deployed onto — that is four connections
// for the entire hall, and every one of them paying TLS and startup on the
// first request of a burst. Queries here are index lookups measured in tens
// of microseconds, so a modest pool serves thousands a second; what hurts is
// having too few to hand out, and handing them out cold.
//
// Both are overridable: a managed Postgres with a low connection allowance
// (Supabase's pooler, a small Railway plan) needs a smaller ceiling, and
// exceeding it fails at the worst moment.
func NewPool(ctx context.Context, dsn string, maxConns, minConns int32) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("parse postgres dsn: %w", err)
	}
	if maxConns > 0 {
		cfg.MaxConns = maxConns
	}
	if minConns > 0 {
		// Kept open and warm, so the morning's first burst does not queue
		// behind connection setup.
		cfg.MinConns = minConns
	}
	cfg.MaxConnLifetime = time.Hour
	cfg.MaxConnIdleTime = 30 * time.Minute
	// A connection that died quietly (a database restart, a proxy timeout)
	// is discovered before a request is handed it, not by that request.
	cfg.HealthCheckPeriod = 30 * time.Second

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("connect postgres: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping postgres: %w", err)
	}
	return pool, nil
}

// bootLockID is the advisory lock the whole fleet agrees on. Any constant
// works as long as every instance uses the same one; this is the event date.
const bootLockID int64 = 20260903

// WithBootLock runs fn while holding a Postgres advisory lock.
//
// Behind a load balancer the API is several containers, and they start
// together. Without this they would each read schema_migrations, each find
// the same migration unapplied, and each run it — seeding the event twice,
// or failing halfway and taking the deploy with them. The lock makes exactly
// one instance do the work; the others block here, then find everything
// already applied and skip straight past it.
//
// The lock is session-scoped, so it has to be taken and released on ONE
// connection rather than anywhere in the pool.
func WithBootLock(ctx context.Context, pool *pgxpool.Pool, fn func(context.Context) error) error {
	conn, err := pool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("acquire boot lock connection: %w", err)
	}
	defer conn.Release()

	if _, err := conn.Exec(ctx, `SELECT pg_advisory_lock($1)`, bootLockID); err != nil {
		return fmt.Errorf("take boot lock: %w", err)
	}
	// Released on its own connection, and with a context of its own: if fn
	// failed because ctx expired, the unlock still has to go out or the next
	// deploy waits on a lock nobody holds.
	defer func() {
		unlockCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if _, err := conn.Exec(unlockCtx, `SELECT pg_advisory_unlock($1)`, bootLockID); err != nil {
			slog.Error("releasing boot lock failed", "err", err)
		}
	}()
	return fn(ctx)
}

// Migrate applies embedded SQL migrations in filename order, tracking them in
// a schema_migrations table.
func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
	if _, err := pool.Exec(ctx,
		`CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`); err != nil {
		return fmt.Errorf("create schema_migrations: %w", err)
	}

	entries, err := migrationsFS.ReadDir("migrations")
	if err != nil {
		return fmt.Errorf("read migrations: %w", err)
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		names = append(names, e.Name())
	}
	sort.Strings(names)

	for _, name := range names {
		var exists bool
		if err := pool.QueryRow(ctx,
			`SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE version = $1)`, name).Scan(&exists); err != nil {
			return err
		}
		if exists {
			continue
		}
		sqlBytes, err := migrationsFS.ReadFile("migrations/" + name)
		if err != nil {
			return err
		}
		tx, err := pool.Begin(ctx)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, string(sqlBytes)); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("apply migration %s: %w", name, err)
		}
		if _, err := tx.Exec(ctx, `INSERT INTO schema_migrations (version) VALUES ($1)`, name); err != nil {
			_ = tx.Rollback(ctx)
			return err
		}
		if err := tx.Commit(ctx); err != nil {
			return err
		}
	}
	return nil
}
