package usecase

import (
	"context"

	"natcon2026/backend/internal/domain"
)

type NetworkingUsecase struct {
	networking domain.NetworkingRepository
}

func NewNetworkingUsecase(networking domain.NetworkingRepository) *NetworkingUsecase {
	return &NetworkingUsecase{networking: networking}
}

func (u *NetworkingUsecase) Status(ctx context.Context, memberID int64) (*domain.NetworkingStatus, error) {
	return u.networking.Status(ctx, memberID)
}

func (u *NetworkingUsecase) CheckIn(ctx context.Context, memberID int64, tableNo int) error {
	if tableNo <= 0 {
		return invalid("nomor meja tidak valid")
	}
	return u.networking.CheckIn(ctx, memberID, tableNo)
}

func (u *NetworkingUsecase) SaveContact(ctx context.Context, ownerID, contactID int64) error {
	return u.networking.SaveContact(ctx, ownerID, contactID)
}

func (u *NetworkingUsecase) SaveAll(ctx context.Context, memberID int64) (int, error) {
	return u.networking.SaveAllTableMates(ctx, memberID)
}

func (u *NetworkingUsecase) History(ctx context.Context, memberID int64) (*domain.NetworkingHistory, error) {
	return u.networking.History(ctx, memberID)
}
