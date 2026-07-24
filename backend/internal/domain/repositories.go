package domain

import "context"

type UserRepository interface {
	GetByEmail(ctx context.Context, email string) (*User, error)
	GetByID(ctx context.Context, id int64) (*User, error)
	GetByMemberCode(ctx context.Context, code string) (*User, error)
}

type TenantRepository interface {
	ListWithVisits(ctx context.Context, memberID int64) ([]TenantWithVisit, error)
	GetByOwnerUserID(ctx context.Context, ownerUserID int64) (*Tenant, error)
	Count(ctx context.Context) (int, error)
}

type VisitRepository interface {
	// Create records a visit. Returns ErrDuplicateVisit when the (tenant,
	// member) pair already exists.
	Create(ctx context.Context, tenantID, memberID int64) (*Visit, error)
	CountByMember(ctx context.Context, memberID int64) (int, error)
	StatsByTenant(ctx context.Context, tenantID int64) (*BoothStats, error)
	RecentVisitors(ctx context.Context, tenantID int64, limit int) ([]Visitor, error)
}

type SeminarRepository interface {
	ListWithStatus(ctx context.Context, memberID int64) ([]SeminarWithStatus, error)
	// Register enforces capacity and one-registration-per-slot atomically.
	// Returns ErrNotFound, ErrSeminarFull, or ErrAlreadyRegistered.
	Register(ctx context.Context, seminarID, memberID int64) error
	CountRegistrationsByMember(ctx context.Context, memberID int64) (int, error)
	CountSlots(ctx context.Context) (int, error)
}
