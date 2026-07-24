package usecase

import (
	"context"

	"natcon2026/backend/internal/domain"
)

type BoothUsecase struct {
	tenants domain.TenantRepository
	visits  domain.VisitRepository
}

func NewBoothUsecase(tenants domain.TenantRepository, visits domain.VisitRepository) *BoothUsecase {
	return &BoothUsecase{tenants: tenants, visits: visits}
}

func (u *BoothUsecase) Booth(ctx context.Context, tenantUserID int64) (*domain.Tenant, error) {
	return u.tenants.GetByOwnerUserID(ctx, tenantUserID)
}

func (u *BoothUsecase) Stats(ctx context.Context, tenantUserID int64) (*domain.BoothStats, error) {
	booth, err := u.tenants.GetByOwnerUserID(ctx, tenantUserID)
	if err != nil {
		return nil, err
	}
	return u.visits.StatsByTenant(ctx, booth.ID)
}

func (u *BoothUsecase) RecentVisitors(ctx context.Context, tenantUserID int64, limit int) ([]domain.Visitor, error) {
	booth, err := u.tenants.GetByOwnerUserID(ctx, tenantUserID)
	if err != nil {
		return nil, err
	}
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	return u.visits.RecentVisitors(ctx, booth.ID, limit)
}
