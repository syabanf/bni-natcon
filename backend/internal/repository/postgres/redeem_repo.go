package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"natcon2026/backend/internal/domain"
)

// Handing over the pin and the goodiebag. Both are scanned at a desk, so both
// need the same guarantee: the second scan of the same person must not hand
// over a second one.

// RedeemItem marks the item collected and reports what the desk needs to see.
// The UPDATE carries the "not already redeemed" condition, so two scanners
// pointed at the same attendee cannot both succeed.
func (r *AdminRepo) RedeemItem(ctx context.Context, memberCode, item string) (*domain.RedeemResult, error) {
	column := "pin_redeemed_at"
	if item == domain.RedeemGoodiebag {
		column = "goodiebag_redeemed_at"
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var res domain.RedeemResult
	var pinAt, bagAt *time.Time
	err = tx.QueryRow(ctx, `
		SELECT id, name, COALESCE(member_code, ''), chapter, company,
		       pin_redeemed_at, goodiebag_redeemed_at,
		       (SELECT COUNT(*) FROM visits v WHERE v.member_id = users.id)
		FROM users
		WHERE role = 'member' AND (`+scanKeySQL+` OR lower(email) = lower($1))
		FOR UPDATE`, memberCode).
		Scan(&res.MemberID, &res.Name, &res.MemberCode, &res.Chapter, &res.Company,
			&pinAt, &bagAt, &res.Visits)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}

	if item == domain.RedeemKit {
		// Both out already: refuse, dated by the later of the two. Otherwise
		// stamp whatever is still owed — one scan, both items.
		if pinAt != nil && bagAt != nil {
			res.RedeemedAt = *pinAt
			if bagAt.After(*pinAt) {
				res.RedeemedAt = *bagAt
			}
			res.AlreadyDone = true
			return &res, domain.ErrAlreadyRedeemed
		}
		var at time.Time
		if err := tx.QueryRow(ctx, `
			UPDATE users
			SET pin_redeemed_at = COALESCE(pin_redeemed_at, now()),
			    goodiebag_redeemed_at = COALESCE(goodiebag_redeemed_at, now())
			WHERE id = $1
			RETURNING GREATEST(pin_redeemed_at, goodiebag_redeemed_at)`,
			res.MemberID).Scan(&at); err != nil {
			return nil, err
		}
		res.RedeemedAt = at
		return &res, tx.Commit(ctx)
	}

	already := pinAt
	if item == domain.RedeemGoodiebag {
		already = bagAt
	}
	if already != nil {
		res.RedeemedAt = *already
		res.AlreadyDone = true
		return &res, domain.ErrAlreadyRedeemed
	}

	var at time.Time
	if err := tx.QueryRow(ctx,
		`UPDATE users SET `+column+` = now() WHERE id = $1 RETURNING `+column,
		res.MemberID).Scan(&at); err != nil {
		return nil, err
	}
	res.RedeemedAt = at
	return &res, tx.Commit(ctx)
}

// RedeemCounts is what the desk screen shows: how many of each have gone out.
func (r *AdminRepo) RedeemCounts(ctx context.Context) (pins, goodiebags, kits, members int, err error) {
	err = r.pool.QueryRow(ctx, `
		SELECT COUNT(*) FILTER (WHERE pin_redeemed_at IS NOT NULL),
		       COUNT(*) FILTER (WHERE goodiebag_redeemed_at IS NOT NULL),
		       COUNT(*) FILTER (WHERE pin_redeemed_at IS NOT NULL AND goodiebag_redeemed_at IS NOT NULL),
		       COUNT(*)
		FROM users WHERE role = 'member'`).Scan(&pins, &goodiebags, &kits, &members)
	return
}
