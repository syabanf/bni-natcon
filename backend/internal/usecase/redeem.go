package usecase

import (
	"context"
	"strings"

	"natcon2026/backend/internal/domain"
)

// Pin and goodiebag are handed over at a desk against a scanned QR (MoM
// 19 Aug 2026). Scanning rather than ticking a box matters for the same
// reason it does at a booth: at a queue nobody reliably finds the right row
// in a list of 769 people.

// MinBoothVisitsForPin is how many booths someone must have visited before
// the pin can be collected. Zero means no condition, which is the default —
// the committee sets a number when they decide there is one.
var MinBoothVisitsForPin = 0

func (u *AdminUsecase) RedeemItem(ctx context.Context, memberCode, item string) (*domain.RedeemResult, error) {
	memberCode = strings.TrimSpace(memberCode)
	if memberCode == "" {
		return nil, invalid("scan the attendee's QR, or type their member code")
	}
	switch item {
	case domain.RedeemPin, domain.RedeemGoodiebag:
	default:
		return nil, invalid("that is not something the desk hands over")
	}
	return u.admin.RedeemItem(ctx, memberCode, item)
}

type RedeemTally struct {
	Pins       int
	Goodiebags int
	Members    int
}

func (u *AdminUsecase) RedeemCounts(ctx context.Context) (RedeemTally, error) {
	pins, bags, members, err := u.admin.RedeemCounts(ctx)
	return RedeemTally{Pins: pins, Goodiebags: bags, Members: members}, err
}
