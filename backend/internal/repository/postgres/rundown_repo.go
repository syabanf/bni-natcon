package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"natcon2026/backend/internal/domain"
)

// The event schedule: one-hour blocks the committee edits, and the source of
// truth for what the attendee agenda shows and when a class happens.

const rundownColumns = `id, starts_at, ends_at, title, place, kind, sort`

func scanRundown(rows pgx.Rows) ([]domain.RundownBlock, error) {
	defer rows.Close()
	out := []domain.RundownBlock{}
	for rows.Next() {
		var b domain.RundownBlock
		if err := rows.Scan(&b.ID, &b.StartsAt, &b.EndsAt, &b.Title, &b.Place,
			&b.Kind, &b.Sort); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

// ListRundown returns the schedule in the order the day runs.
func (r *AdminRepo) ListRundown(ctx context.Context) ([]domain.RundownBlock, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT `+rundownColumns+` FROM rundown ORDER BY starts_at, sort, id`)
	if err != nil {
		return nil, err
	}
	return scanRundown(rows)
}

func (r *AdminRepo) CreateRundown(ctx context.Context, b domain.RundownBlock) (*domain.RundownBlock, error) {
	var out domain.RundownBlock
	err := r.pool.QueryRow(ctx, `
		INSERT INTO rundown (starts_at, ends_at, title, place, kind, sort)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING `+rundownColumns,
		b.StartsAt, b.EndsAt, b.Title, b.Place, b.Kind, b.Sort).
		Scan(&out.ID, &out.StartsAt, &out.EndsAt, &out.Title, &out.Place, &out.Kind, &out.Sort)
	if err != nil {
		return nil, err
	}
	return &out, nil
}

func (r *AdminRepo) UpdateRundown(ctx context.Context, id int64, b domain.RundownBlock) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE rundown SET starts_at = $1, ends_at = $2, title = $3, place = $4,
		       kind = $5, sort = $6
		WHERE id = $7`,
		b.StartsAt, b.EndsAt, b.Title, b.Place, b.Kind, b.Sort, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

// DeleteRundown removes a block. Classes placed in it are not deleted — they
// simply lose their slot (ON DELETE SET NULL) and the committee re-places
// them, which is kinder than refusing to delete or destroying a class.
func (r *AdminRepo) DeleteRundown(ctx context.Context, id int64) error {
	tag, err := r.pool.Exec(ctx, `DELETE FROM rundown WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

// RundownForSeminars returns the block each of the given classes sits in,
// keyed by class id, skipping classes that have not been placed.
func (r *AdminRepo) RundownForSeminars(ctx context.Context, ids []int64) (map[int64]domain.RundownBlock, error) {
	out := map[int64]domain.RundownBlock{}
	if len(ids) == 0 {
		return out, nil
	}
	rows, err := r.pool.Query(ctx, `
		SELECT s.id, `+rundownColumns+`
		FROM seminars s JOIN rundown ON rundown.id = s.rundown_id
		WHERE s.id = ANY($1)`, ids)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return out, nil
		}
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var seminarID int64
		var b domain.RundownBlock
		if err := rows.Scan(&seminarID, &b.ID, &b.StartsAt, &b.EndsAt, &b.Title,
			&b.Place, &b.Kind, &b.Sort); err != nil {
			return nil, err
		}
		out[seminarID] = b
	}
	return out, rows.Err()
}
