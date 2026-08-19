package usecase

import (
	"context"
	"strings"
	"time"

	"natcon2026/backend/internal/domain"
)

// The event schedule (MoM 19 Aug 2026). The committee edits it in one-hour
// blocks; everything else in the app reads the time from here rather than
// carrying its own copy.

// BlockMinutes is the grain the committee agreed on. Blocks are checked
// against it so a rundown cannot quietly drift into 47-minute slots that no
// printed programme will match.
const BlockMinutes = 60

var rundownKinds = map[string]bool{
	domain.RundownRegistration: true,
	domain.RundownPlenary:      true,
	domain.RundownLearning:     true,
	domain.RundownNetworking:   true,
	domain.RundownBreak:        true,
	domain.RundownDoorprize:    true,
}

func (u *AdminUsecase) ListRundown(ctx context.Context) ([]domain.RundownBlock, error) {
	return u.admin.ListRundown(ctx)
}

func (u *AdminUsecase) CreateRundown(ctx context.Context, b domain.RundownBlock) (*domain.RundownBlock, error) {
	if err := validateRundown(&b); err != nil {
		return nil, err
	}
	return u.admin.CreateRundown(ctx, b)
}

func (u *AdminUsecase) UpdateRundown(ctx context.Context, id int64, b domain.RundownBlock) error {
	if err := validateRundown(&b); err != nil {
		return err
	}
	return u.admin.UpdateRundown(ctx, id, b)
}

func (u *AdminUsecase) DeleteRundown(ctx context.Context, id int64) error {
	return u.admin.DeleteRundown(ctx, id)
}

func validateRundown(b *domain.RundownBlock) error {
	b.Title = strings.TrimSpace(b.Title)
	b.Place = strings.TrimSpace(b.Place)
	if b.Title == "" {
		return invalid("title is required")
	}
	if b.Kind == "" {
		b.Kind = domain.RundownPlenary
	}
	if !rundownKinds[b.Kind] {
		return invalid("unknown block kind")
	}
	if b.StartsAt.IsZero() {
		return invalid("start time is required")
	}
	// An end time is optional in the form: a block is one hour unless the
	// committee says otherwise, which is the whole point of a block grid.
	if b.EndsAt.IsZero() {
		b.EndsAt = b.StartsAt.Add(BlockMinutes * time.Minute)
	}
	if !b.EndsAt.After(b.StartsAt) {
		return invalid("the block has to end after it starts")
	}
	if b.EndsAt.Sub(b.StartsAt)%(BlockMinutes*time.Minute) != 0 {
		return invalid("blocks run in whole hours — make it 1, 2, 3 hours long")
	}
	if b.StartsAt.Minute() != 0 || b.StartsAt.Second() != 0 {
		return invalid("blocks start on the hour")
	}
	return nil
}
