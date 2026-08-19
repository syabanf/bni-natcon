package usecase

import (
	"context"
	"strings"

	"natcon2026/backend/internal/domain"
)

// The event's two draws (MoM 19 Aug 2026): the Lucky Draw and the Doorprize,
// each with its own winners and its own entry condition.

func (u *AdminUsecase) Draws(ctx context.Context) ([]domain.Draw, error) {
	return u.admin.Draws(ctx)
}

func validDrawKey(key string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(key)) {
	case domain.DrawLucky:
		return domain.DrawLucky, nil
	case domain.DrawDoorprize:
		return domain.DrawDoorprize, nil
	}
	return "", invalid("there are two draws: lucky and doorprize")
}

// SetDrawMinimum sets how many booths an attendee must have visited to enter.
// Zero is the honest default — the committee decides on the day whether the
// prize is a reward for walking the floor.
func (u *AdminUsecase) SetDrawMinimum(ctx context.Context, key string, min int) error {
	k, err := validDrawKey(key)
	if err != nil {
		return err
	}
	if min < 0 {
		return invalid("a minimum below zero is not a condition")
	}
	return u.admin.SetDrawMinimum(ctx, k, min)
}

func (u *AdminUsecase) DrawPool(ctx context.Context, key string) ([]domain.DrawEntrant, error) {
	k, err := validDrawKey(key)
	if err != nil {
		return nil, err
	}
	return u.admin.DrawPool(ctx, k)
}

func (u *AdminUsecase) Pick(ctx context.Context, key string) (*domain.DrawWinner, error) {
	k, err := validDrawKey(key)
	if err != nil {
		return nil, err
	}
	return u.admin.Pick(ctx, k)
}

func (u *AdminUsecase) DrawWinners(ctx context.Context, key string) ([]domain.DrawWinner, error) {
	k, err := validDrawKey(key)
	if err != nil {
		return nil, err
	}
	return u.admin.DrawWinners(ctx, k)
}

func (u *AdminUsecase) ResetDraw(ctx context.Context, key string) error {
	k, err := validDrawKey(key)
	if err != nil {
		return err
	}
	return u.admin.ResetDraw(ctx, k)
}
