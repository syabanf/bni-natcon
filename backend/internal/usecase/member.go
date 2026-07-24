package usecase

import (
	"context"

	"natcon2026/backend/internal/domain"
)

type MemberUsecase struct {
	users    domain.UserRepository
	tenants  domain.TenantRepository
	visits   domain.VisitRepository
	seminars domain.SeminarRepository
}

func NewMemberUsecase(
	users domain.UserRepository,
	tenants domain.TenantRepository,
	visits domain.VisitRepository,
	seminars domain.SeminarRepository,
) *MemberUsecase {
	return &MemberUsecase{users: users, tenants: tenants, visits: visits, seminars: seminars}
}

func (u *MemberUsecase) Profile(ctx context.Context, userID int64) (*domain.User, *domain.MemberStats, error) {
	user, err := u.users.GetByID(ctx, userID)
	if err != nil {
		return nil, nil, err
	}
	if user.Role != domain.RoleMember {
		// Tenant users have no member stats.
		return user, nil, nil
	}
	visited, err := u.visits.CountByMember(ctx, userID)
	if err != nil {
		return nil, nil, err
	}
	totalTenants, err := u.tenants.Count(ctx)
	if err != nil {
		return nil, nil, err
	}
	picked, err := u.seminars.CountRegistrationsByMember(ctx, userID)
	if err != nil {
		return nil, nil, err
	}
	slots, err := u.seminars.CountSlots(ctx)
	if err != nil {
		return nil, nil, err
	}
	stats := &domain.MemberStats{
		TenantsVisited: visited,
		TenantsTotal:   totalTenants,
		Coupons:        visited,
		SeminarsPicked: picked,
		SeminarsTotal:  slots,
	}
	return user, stats, nil
}

func (u *MemberUsecase) ListTenants(ctx context.Context, memberID int64) ([]domain.TenantWithVisit, error) {
	return u.tenants.ListWithVisits(ctx, memberID)
}
