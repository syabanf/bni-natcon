package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"natcon2026/backend/internal/domain"
)

type NetworkingRepo struct {
	pool *pgxpool.Pool
}

func NewNetworkingRepo(pool *pgxpool.Pool) *NetworkingRepo {
	return &NetworkingRepo{pool: pool}
}

func (r *NetworkingRepo) Status(ctx context.Context, memberID int64) (*domain.NetworkingStatus, error) {
	status := &domain.NetworkingStatus{}

	rows, err := r.pool.Query(ctx, `
		SELECT t.id, t.table_no, t.hall, t.capacity,
		       (SELECT COUNT(*) FROM networking_checkins c WHERE c.table_id = t.id)
		FROM networking_tables t
		ORDER BY t.table_no`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var t domain.NetworkingTable
		if err := rows.Scan(&t.ID, &t.TableNo, &t.Hall, &t.Capacity, &t.Occupied); err != nil {
			return nil, err
		}
		status.Tables = append(status.Tables, t)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	var tableID int64
	var seatNo int
	err = r.pool.QueryRow(ctx,
		`SELECT table_id, seat_no FROM networking_checkins WHERE member_id = $1`, memberID).
		Scan(&tableID, &seatNo)
	if errors.Is(err, pgx.ErrNoRows) {
		return status, nil
	}
	if err != nil {
		return nil, err
	}

	status.CheckedIn = true
	status.SeatNo = seatNo
	for i := range status.Tables {
		if status.Tables[i].ID == tableID {
			status.Table = &status.Tables[i]
		}
	}

	mateRows, err := r.pool.Query(ctx, `
		SELECT u.id, u.name, u.chapter, u.company, c.seat_no,
		       (u.id = $1) AS is_me,
		       EXISTS (
		           SELECT 1 FROM networking_contacts nc
		           WHERE nc.owner_id = $1 AND nc.contact_id = u.id
		       ) AS saved
		FROM networking_checkins c
		JOIN users u ON u.id = c.member_id
		WHERE c.table_id = $2
		ORDER BY c.seat_no`, memberID, tableID)
	if err != nil {
		return nil, err
	}
	defer mateRows.Close()
	for mateRows.Next() {
		var m domain.TableMate
		if err := mateRows.Scan(&m.MemberID, &m.Name, &m.Chapter, &m.Company, &m.SeatNo, &m.IsMe, &m.Saved); err != nil {
			return nil, err
		}
		status.Mates = append(status.Mates, m)
	}
	return status, mateRows.Err()
}

func (r *NetworkingRepo) CheckIn(ctx context.Context, memberID int64, tableNo int) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var tableID int64
	var capacity int
	err = tx.QueryRow(ctx,
		`SELECT id, capacity FROM networking_tables WHERE table_no = $1 FOR UPDATE`, tableNo).
		Scan(&tableID, &capacity)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ErrNotFound
		}
		return err
	}

	// Moving tables: release the current seat first.
	if _, err := tx.Exec(ctx,
		`DELETE FROM networking_checkins WHERE member_id = $1`, memberID); err != nil {
		return err
	}

	var occupied int
	if err := tx.QueryRow(ctx,
		`SELECT COUNT(*) FROM networking_checkins WHERE table_id = $1`, tableID).Scan(&occupied); err != nil {
		return err
	}
	if occupied >= capacity {
		return domain.ErrTableFull
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO networking_checkins (table_id, member_id, seat_no)
		VALUES ($1, $2, (
			SELECT COALESCE(MAX(seat_no), 0) + 1 FROM networking_checkins WHERE table_id = $1
		))`, tableID, memberID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *NetworkingRepo) SaveContact(ctx context.Context, ownerID, contactID int64) error {
	var exists bool
	if err := r.pool.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM users WHERE id = $1 AND role = 'member')`, contactID).
		Scan(&exists); err != nil {
		return err
	}
	if !exists || ownerID == contactID {
		return domain.ErrNotFound
	}
	_, err := r.pool.Exec(ctx, `
		INSERT INTO networking_contacts (owner_id, contact_id)
		VALUES ($1, $2) ON CONFLICT DO NOTHING`, ownerID, contactID)
	return err
}

func (r *NetworkingRepo) SaveAllTableMates(ctx context.Context, memberID int64) (int, error) {
	tag, err := r.pool.Exec(ctx, `
		INSERT INTO networking_contacts (owner_id, contact_id)
		SELECT $1, c2.member_id
		FROM networking_checkins c1
		JOIN networking_checkins c2 ON c2.table_id = c1.table_id AND c2.member_id <> $1
		WHERE c1.member_id = $1
		ON CONFLICT DO NOTHING`, memberID)
	if err != nil {
		return 0, err
	}
	return int(tag.RowsAffected()), nil
}
