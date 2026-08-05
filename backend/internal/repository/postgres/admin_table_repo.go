package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"natcon2026/backend/internal/domain"
)

// Networking tables are master data the committee generates before the
// event; occupancy comes from the live check-ins.

const tableColumns = `t.id, t.table_no, t.hall, t.capacity,
	(SELECT COUNT(*) FROM networking_checkins c WHERE c.table_id = t.id)`

func scanTables(rows pgx.Rows) ([]domain.NetworkingTable, error) {
	defer rows.Close()
	var out []domain.NetworkingTable
	for rows.Next() {
		var t domain.NetworkingTable
		if err := rows.Scan(&t.ID, &t.TableNo, &t.Hall, &t.Capacity, &t.Occupied); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (r *AdminRepo) ListTables(ctx context.Context) ([]domain.NetworkingTable, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT `+tableColumns+` FROM networking_tables t ORDER BY t.table_no`)
	if err != nil {
		return nil, err
	}
	return scanTables(rows)
}

// GenerateTables appends count tables, continuing the numbering after the
// highest existing table so it can be run repeatedly to grow the hall.
func (r *AdminRepo) GenerateTables(ctx context.Context, count int, hall string, capacity int) ([]domain.NetworkingTable, error) {
	rows, err := r.pool.Query(ctx, `
		WITH next AS (
			SELECT COALESCE(MAX(table_no), 0) AS start FROM networking_tables
		), created AS (
			INSERT INTO networking_tables (table_no, hall, capacity)
			SELECT next.start + g, $2, $3
			FROM next, generate_series(1, $1) AS g
			RETURNING id, table_no, hall, capacity
		)
		SELECT id, table_no, hall, capacity, 0 FROM created ORDER BY table_no`,
		count, hall, capacity)
	if err != nil {
		return nil, err
	}
	return scanTables(rows)
}

func (r *AdminRepo) UpdateTable(ctx context.Context, id int64, hall string, capacity int) error {
	var occupied int
	err := r.pool.QueryRow(ctx, `
		SELECT (SELECT COUNT(*) FROM networking_checkins c WHERE c.table_id = t.id)
		FROM networking_tables t WHERE t.id = $1`, id).Scan(&occupied)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ErrNotFound
		}
		return err
	}
	if capacity < occupied {
		return domain.ErrInvalidInput
	}
	_, err = r.pool.Exec(ctx,
		`UPDATE networking_tables SET hall = $1, capacity = $2 WHERE id = $3`, hall, capacity, id)
	return err
}

func (r *AdminRepo) DeleteTable(ctx context.Context, id int64) error {
	var occupied int
	err := r.pool.QueryRow(ctx, `
		SELECT (SELECT COUNT(*) FROM networking_checkins c WHERE c.table_id = t.id)
		FROM networking_tables t WHERE t.id = $1`, id).Scan(&occupied)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ErrNotFound
		}
		return err
	}
	if occupied > 0 {
		return domain.ErrTableInUse
	}
	_, err = r.pool.Exec(ctx, `DELETE FROM networking_tables WHERE id = $1`, id)
	return err
}
