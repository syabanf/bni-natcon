package usecase

import (
	"context"

	"natcon2026/backend/internal/domain"
)

type SeminarUsecase struct {
	seminars domain.SeminarRepository
}

func NewSeminarUsecase(seminars domain.SeminarRepository) *SeminarUsecase {
	return &SeminarUsecase{seminars: seminars}
}

func (u *SeminarUsecase) List(ctx context.Context, memberID int64) ([]domain.SeminarWithStatus, error) {
	return u.seminars.ListWithStatus(ctx, memberID)
}

// Attendees backs the "who else is in this room" list.
func (u *SeminarUsecase) Attendees(ctx context.Context, seminarID int64) ([]domain.SeminarAttendee, error) {
	return u.seminars.Attendees(ctx, seminarID)
}

func (u *SeminarUsecase) Register(ctx context.Context, seminarID, memberID int64) error {
	return u.seminars.Register(ctx, seminarID, memberID)
}

func (u *SeminarUsecase) Unregister(ctx context.Context, seminarID, memberID int64) error {
	return u.seminars.Unregister(ctx, seminarID, memberID)
}
