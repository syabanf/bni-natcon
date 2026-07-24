package usecase

import (
	"context"
	"errors"
	"strings"

	"natcon2026/backend/internal/domain"
)

type ScanUsecase struct {
	users   domain.UserRepository
	tenants domain.TenantRepository
	visits  domain.VisitRepository
}

func NewScanUsecase(users domain.UserRepository, tenants domain.TenantRepository, visits domain.VisitRepository) *ScanUsecase {
	return &ScanUsecase{users: users, tenants: tenants, visits: visits}
}

// Scan records a member's visit at the booth owned by tenantUserID.
// A duplicate scan is not an error: the scanner UI still needs the member's
// identity, so the result carries a Duplicate flag instead.
func (u *ScanUsecase) Scan(ctx context.Context, tenantUserID int64, memberCode string) (*domain.ScanResult, error) {
	booth, err := u.tenants.GetByOwnerUserID(ctx, tenantUserID)
	if err != nil {
		return nil, err
	}
	member, err := u.users.GetByMemberCode(ctx, strings.TrimSpace(memberCode))
	if err != nil {
		return nil, err
	}

	duplicate := false
	if _, err := u.visits.Create(ctx, booth.ID, member.ID); err != nil {
		if !errors.Is(err, domain.ErrDuplicateVisit) {
			return nil, err
		}
		duplicate = true
	}

	coupons, err := u.visits.CountByMember(ctx, member.ID)
	if err != nil {
		return nil, err
	}
	return &domain.ScanResult{
		MemberName:    member.Name,
		MemberChapter: member.Chapter,
		MemberCompany: member.Company,
		Duplicate:     duplicate,
		Coupons:       coupons,
	}, nil
}
