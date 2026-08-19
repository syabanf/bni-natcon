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
		SELECT s.id, s.slot, s.room, s.title, s.speaker, s.moderator, s.capacity, s.description,
		       s.cover_url, s.poster_url, COALESCE(s.rundown_id, 0), b.starts_at, b.ends_at,
		       (SELECT COUNT(*) FROM seminar_registrations sr WHERE sr.seminar_id = s.id) AS taken,
		       EXISTS (SELECT 1 FROM seminar_registrations sr WHERE sr.seminar_id = s.id AND sr.member_id = $1) AS registered,
		       EXISTS (SELECT 1 FROM seminar_attendance sa WHERE sa.seminar_id = s.id AND sa.member_id = $1) AS attended
		FROM seminars s LEFT JOIN rundown b ON b.id = s.rundown_id
		ORDER BY b.starts_at NULLS LAST, s.slot, s.room`, memberID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domain.SeminarWithStatus
	for rows.Next() {
		var s domain.SeminarWithStatus
		if err := rows.Scan(&s.ID, &s.Slot, &s.Room, &s.Title, &s.Speaker, &s.Moderator,
			&s.Capacity, &s.Description, &s.CoverURL, &s.PosterURL, &s.RundownID,
			&s.StartsAt, &s.EndsAt, &s.SeatsTaken, &s.Registered, &s.Attended); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// One extra query for every class rather than one per class.
	byID, err := loadSpeakers(ctx, r.pool, nil)
	if err != nil {
		return nil, err
	}
	for i := range out {
		out[i].Speakers = byID[out[i].ID]
	}
	return out, nil
}

// loadSpeakers returns the speaker rows grouped by seminar. A nil id list
// loads every class; otherwise only the ones asked for.
func loadSpeakers(ctx context.Context, pool *pgxpool.Pool, ids []int64) (map[int64][]domain.SeminarSpeaker, error) {
	query := `SELECT seminar_id, id, name, role, title, photo_url, sort
	          FROM seminar_speakers`
	args := []any{}
	if ids != nil {
		query += ` WHERE seminar_id = ANY($1)`
		args = append(args, ids)
	}
	query += ` ORDER BY seminar_id, sort, id`
	rows, err := pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[int64][]domain.SeminarSpeaker{}
	for rows.Next() {
		var semID int64
		var sp domain.SeminarSpeaker
		if err := rows.Scan(&semID, &sp.ID, &sp.Name, &sp.Role, &sp.Title, &sp.PhotoURL, &sp.Sort); err != nil {
			return nil, err
		}
		out[semID] = append(out[semID], sp)
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
	var rundownID *int64
	err = tx.QueryRow(ctx,
		`SELECT slot, capacity, rundown_id FROM seminars WHERE id = $1 FOR UPDATE`, seminarID).
		Scan(&slot, &capacity, &rundownID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ErrNotFound
		}
		return err
	}

	// Two classes each, and never two at the same hour (MoM 19 Aug 2026).
	// Counted here rather than in the usecase so a double-tap cannot slip two
	// registrations past the check.
	var held int
	if err := tx.QueryRow(ctx,
		`SELECT COUNT(*) FROM seminar_registrations WHERE member_id = $1`, memberID).Scan(&held); err != nil {
		return err
	}
	if held >= domain.MaxLearningSessions {
		return domain.ErrTooManySessions
	}

	// A class the committee has not placed in the rundown yet has no time to
	// clash with — it still counts towards the two, but cannot be checked
	// for overlap.
	if rundownID != nil {
		var clash bool
		if err := tx.QueryRow(ctx, `
			SELECT EXISTS (
				SELECT 1
				FROM seminar_registrations sr
				JOIN seminars s  ON s.id = sr.seminar_id
				JOIN rundown  b  ON b.id = s.rundown_id
				JOIN rundown  nb ON nb.id = $2
				WHERE sr.member_id = $1
				  AND b.starts_at < nb.ends_at
				  AND nb.starts_at < b.ends_at
			)`, memberID, *rundownID).Scan(&clash); err != nil {
			return err
		}
		if clash {
			return domain.ErrSessionClash
		}
	}

	// `slot` was the old stand-in for "at the same time", from before classes
	// had real hours. Where a class sits in the rundown, the hours decide —
	// otherwise two classes at 13:00 and 15:00 would still be refused for
	// sharing a slot number. Classes the committee has not placed yet keep
	// the old rule, because it is the only time signal they carry.
	if rundownID == nil {
		var alreadyInSlot bool
		err = tx.QueryRow(ctx, `
			SELECT EXISTS (
				SELECT 1 FROM seminar_registrations sr
				JOIN seminars s ON s.id = sr.seminar_id
				WHERE sr.member_id = $1 AND s.slot = $2 AND s.rundown_id IS NULL
			)`, memberID, slot).Scan(&alreadyInSlot)
		if err != nil {
			return err
		}
		if alreadyInSlot {
			return domain.ErrAlreadyRegistered
		}
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

// Attendees lists everyone registered for a class, so an attendee can see who
// else is in the room. Only name, chapter, company and check-in status —
// contact details stay behind speed networking.
func (r *SeminarRepo) Attendees(ctx context.Context, seminarID int64) ([]domain.SeminarAttendee, error) {
	var exists bool
	if err := r.pool.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM seminars WHERE id = $1)`, seminarID).Scan(&exists); err != nil {
		return nil, err
	}
	if !exists {
		return nil, domain.ErrNotFound
	}
	rows, err := r.pool.Query(ctx, `
		SELECT u.name, COALESCE(u.member_code, ''), u.chapter, u.company, sr.created_at,
		       sa.created_at
		FROM seminar_registrations sr
		JOIN users u ON u.id = sr.member_id
		LEFT JOIN seminar_attendance sa
		       ON sa.seminar_id = sr.seminar_id AND sa.member_id = sr.member_id
		WHERE sr.seminar_id = $1
		ORDER BY u.name`, seminarID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.SeminarAttendee
	for rows.Next() {
		var a domain.SeminarAttendee
		if err := rows.Scan(&a.Name, &a.MemberCode, &a.Chapter, &a.Company,
			&a.RegisteredAt, &a.CheckedInAt); err != nil {
			return nil, err
		}
		a.CheckedIn = a.CheckedInAt != nil
		out = append(out, a)
	}
	return out, rows.Err()
}
