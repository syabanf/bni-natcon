package usecase

import (
	"context"
	"errors"
	"time"

	"natcon2026/backend/internal/domain"
)

// The speed-networking round (MoM 19 Aug 2026): the committee starts it, and
// every attendee counts down to the same moment.

const (
	// DefaultRoundMinutes is the round length the committee runs unless they
	// say otherwise.
	DefaultRoundMinutes = 15
	maxRoundMinutes     = 180
)

// SessionState is what both apps need to draw a clock: the round, when it
// ends, and what the server thinks the time is — so a phone with a wrong
// clock still shows the right number of seconds.
type SessionState struct {
	Session *domain.NetworkingSession
	Now     time.Time
}

func (u *AdminUsecase) CurrentSession(ctx context.Context) (SessionState, error) {
	now, err := u.admin.ServerNow(ctx)
	if err != nil {
		return SessionState{}, err
	}
	s, err := u.admin.CurrentSession(ctx)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			// No round has ever run. That is a state, not a failure: the
			// attendee app shows "waiting to start".
			return SessionState{Now: now}, nil
		}
		return SessionState{}, err
	}
	return SessionState{Session: s, Now: now}, nil
}

func (u *AdminUsecase) StartSession(ctx context.Context, minutes int) (SessionState, error) {
	if minutes <= 0 {
		minutes = DefaultRoundMinutes
	}
	if minutes > maxRoundMinutes {
		return SessionState{}, invalid("a round longer than three hours is probably a typo")
	}
	s, err := u.admin.StartSession(ctx, minutes)
	if err != nil {
		return SessionState{}, err
	}
	now, err := u.admin.ServerNow(ctx)
	if err != nil {
		return SessionState{}, err
	}
	return SessionState{Session: s, Now: now}, nil
}

func (u *AdminUsecase) StopSession(ctx context.Context) error {
	return u.admin.StopSession(ctx)
}
