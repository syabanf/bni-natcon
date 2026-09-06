package postgres

import (
	"context"
	"errors"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"

	"natcon2026/backend/internal/domain"
)

// The two draws. Picking a winner happens here, in one transaction, so the
// result is recorded before anyone sees it: a browser that reloads mid-
// ceremony finds the same list of winners rather than an empty one.

func (r *AdminRepo) Draws(ctx context.Context) ([]domain.Draw, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT d.key, d.name, d.prize_name, d.prize_list, d.min_booth_visits,
		       (SELECT COUNT(*) FROM draw_winners w WHERE w.draw_key = d.key)
		FROM draws d ORDER BY d.key`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Draw{}
	for rows.Next() {
		var d domain.Draw
		if err := rows.Scan(&d.Key, &d.Name, &d.PrizeName, &d.PrizeList, &d.MinBoothVisits, &d.WinnerCount); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

func (r *AdminRepo) SetDrawMinimum(ctx context.Context, key string, min int) error {
	tag, err := r.pool.Exec(ctx,
		`UPDATE draws SET min_booth_visits = $1 WHERE key = $2`, min, key)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *AdminRepo) SetDrawPrizeName(ctx context.Context, key, prizeName string) error {
	tag, err := r.pool.Exec(ctx,
		`UPDATE draws SET prize_name = $1 WHERE key = $2`, prizeName, key)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *AdminRepo) SetDrawPrizeList(ctx context.Context, key string, prizes []string) error {
	tag, err := r.pool.Exec(ctx,
		`UPDATE draws SET prize_list = $1 WHERE key = $2`, prizes, key)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

// eligibleSQL is the pool for a draw: registered attendees who have visited
// enough booths and have not already won something. Winning any draw takes
// you out of both — "jangan sampai menang 2 kali" is about the guest, not
// about the prize table.
const eligibleSQL = `
	SELECT u.id AS id, u.name AS name, COALESCE(u.member_code, '') AS member_code,
	       u.chapter AS chapter, u.company AS company,
	       (SELECT COUNT(*) FROM visits v WHERE v.member_id = u.id) AS visits
	FROM users u
	WHERE u.role = 'member'
	  AND (SELECT COUNT(*) FROM visits v WHERE v.member_id = u.id) >=
	      (SELECT min_booth_visits FROM draws WHERE key = $1)
	  AND NOT EXISTS (SELECT 1 FROM draw_winners w WHERE w.member_id = u.id)`

func (r *AdminRepo) DrawPool(ctx context.Context, key string) ([]domain.DrawEntrant, error) {
	rows, err := r.pool.Query(ctx, eligibleSQL+excludedFromRandomSQL+` ORDER BY u.id`, key)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.DrawEntrant{}
	for rows.Next() {
		var e domain.DrawEntrant
		if err := rows.Scan(&e.MemberID, &e.Name, &e.MemberCode, &e.Chapter,
			&e.Company, &e.Visits); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

// reservedPicks ties one prize to one attendee when the committee has
// decided in advance who the prize is for (3 Sep 2026: the Diamond door
// prize is for Dedy Dahlan, NATCON-2026-09722). Key: the prize name exactly
// as it sits in the draw page's prize list, lower-cased and trimmed. Every
// other prize is drawn at random from the eligible pool. The reserved pick
// still only counts if that attendee is eligible at the moment of the draw
// and has not already won something — nobody takes two prizes home.
var reservedPicks = map[string]string{
	"diamond": "NATCON-2026-09722",
}

// excludedFromRandomSQL keeps every reserved attendee out of every OTHER
// prize's random pick — Dedy Dahlan wins the Diamond and nothing else, so
// he is still eligible and unwon when the Diamond spin arrives. Built from
// reservedPicks so the two can never drift apart.
var excludedFromRandomSQL = func() string {
	codes := make([]string, 0, len(reservedPicks))
	for _, c := range reservedPicks {
		codes = append(codes, c)
	}
	sort.Strings(codes)
	var b strings.Builder
	b.WriteString(" AND u.member_code NOT IN (")
	for i, c := range codes {
		if i > 0 {
			b.WriteString(",")
		}
		b.WriteString("'")
		b.WriteString(c)
		b.WriteString("'")
	}
	b.WriteString(")")
	return b.String()
}()
// Pick draws one winner and writes it down in the same transaction. Two
// operators pressing at once cannot pull the same name twice: the unique
// index refuses the second, and the caller sees an error rather than a
// duplicate on the screen behind them.
func (r *AdminRepo) Pick(ctx context.Context, key string) (*domain.DrawWinner, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	// Which prize this spin hands out — the next unconsumed line of the
	// queue (1-based: winner position N takes prize_list[N]). An empty list
	// means no prize name guards the pick.
	var upcoming string
	if err := tx.QueryRow(ctx, `
		SELECT COALESCE(prize_list[(SELECT COUNT(*) + 1 FROM draw_winners WHERE draw_key = $1)], '')
		FROM draws WHERE key = $1`, key).Scan(&upcoming); err != nil {
		return nil, err
	}
	memberCode, reserved := reservedPicks[strings.ToLower(strings.TrimSpace(upcoming))]

	// The reserved member is tried first, narrowed to their single row; if
	// they are no longer eligible (already a winner, or below the booth
	// bar), the spin falls back to a fair random pick rather than failing
	// the ceremony.
	var w domain.DrawWinner
	attempt := func(poolSQL string, args ...any) error {
		return tx.QueryRow(ctx, `
			WITH picked AS (`+poolSQL+`
				ORDER BY random() LIMIT 1
			), saved AS (
				INSERT INTO draw_winners (draw_key, member_id, position)
				SELECT $1, picked.id,
				       (SELECT COUNT(*) + 1 FROM draw_winners WHERE draw_key = $1)
				FROM picked
				RETURNING member_id, position, won_at
			)
			SELECT p.id, p.name, p.member_code, p.chapter, p.company, p.visits,
			       s.position, s.won_at
			FROM saved s JOIN picked p ON p.id = s.member_id`, args...).
			Scan(&w.MemberID, &w.Name, &w.MemberCode, &w.Chapter, &w.Company, &w.Visits,
				&w.Position, &w.WonAt)
	}

	pickErr := error(nil)
	if reserved {
		pickErr = attempt(eligibleSQL+` AND u.member_code = $2`, key, memberCode)
		if errors.Is(pickErr, pgx.ErrNoRows) {
			pickErr = attempt(eligibleSQL+excludedFromRandomSQL, key)
		}
	} else {
		pickErr = attempt(eligibleSQL+excludedFromRandomSQL, key)
	}
	if pickErr != nil {
		if errors.Is(pickErr, pgx.ErrNoRows) {
			return nil, domain.ErrDrawPoolEmpty
		}
		return nil, pickErr
	}
	return &w, tx.Commit(ctx)
}

func (r *AdminRepo) DrawWinners(ctx context.Context, key string) ([]domain.DrawWinner, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT u.id, u.name, COALESCE(u.member_code, ''), u.chapter, u.company,
		       (SELECT COUNT(*) FROM visits v WHERE v.member_id = u.id),
		       w.position, w.won_at
		FROM draw_winners w JOIN users u ON u.id = w.member_id
		WHERE w.draw_key = $1
		ORDER BY w.position`, key)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.DrawWinner{}
	for rows.Next() {
		var w domain.DrawWinner
		if err := rows.Scan(&w.MemberID, &w.Name, &w.MemberCode, &w.Chapter, &w.Company,
			&w.Visits, &w.Position, &w.WonAt); err != nil {
			return nil, err
		}
		out = append(out, w)
	}
	return out, rows.Err()
}

// ResetDraw clears a draw's winners — for a rehearsal, or a ceremony that has
// to start again.
func (r *AdminRepo) ResetDraw(ctx context.Context, key string) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM draw_winners WHERE draw_key = $1`, key)
	return err
}
