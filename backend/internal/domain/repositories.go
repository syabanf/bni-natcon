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

type AdminRepository interface {
	Overview(ctx context.Context) (*AdminOverview, error)
	TenantRanking(ctx context.Context) ([]TenantScanCount, error)
	SeminarFill(ctx context.Context) ([]SeminarFill, error)
	RecentActivity(ctx context.Context, limit int) ([]ActivityItem, error)

	// Master data. Create/Update return ErrEmailTaken on duplicate emails;
	// Update/Delete return ErrNotFound for unknown ids. Deletes cascade to
	// dependent rows (visits, registrations, booth login users).
	ListMembers(ctx context.Context) ([]MemberSummary, error)
	CreateMember(ctx context.Context, m NewMember) (*User, error)
	UpdateMember(ctx context.Context, id int64, m MemberUpdate) error
	DeleteMember(ctx context.Context, id int64) error

	CreateTenant(ctx context.Context, t NewTenant) (*Tenant, error)
	UpdateTenant(ctx context.Context, id int64, t TenantUpdate) error
	DeleteTenant(ctx context.Context, id int64) error

	CreateSeminar(ctx context.Context, s SeminarInput) (*Seminar, error)
	UpdateSeminar(ctx context.Context, id int64, s SeminarInput) error
	DeleteSeminar(ctx context.Context, id int64) error

	VisitReport(ctx context.Context) ([]VisitReportRow, error)
	RegistrationReport(ctx context.Context) ([]RegistrationReportRow, error)

	// Detail pages; each returns ErrNotFound for unknown ids.
	MemberDetail(ctx context.Context, id int64) (*MemberDetail, error)
	TenantDetail(ctx context.Context, id int64) (*TenantDetail, error)
	SeminarDetail(ctx context.Context, id int64) (*SeminarDetail, error)
}

type NetworkingRepository interface {
	// Status returns the member's check-in (table + mates with saved flags)
	// plus the full table list with occupancy.
	Status(ctx context.Context, memberID int64) (*NetworkingStatus, error)
	// CheckIn seats the member at the table (moving them if already seated
	// elsewhere). Returns ErrNotFound for unknown tables, ErrTableFull when
	// all seats are taken.
	CheckIn(ctx context.Context, memberID int64, tableNo int) error
	// SaveContact stores a contact; saving twice is a no-op.
	SaveContact(ctx context.Context, ownerID, contactID int64) error
	// SaveAllTableMates saves everyone currently at the member's table.
	SaveAllTableMates(ctx context.Context, memberID int64) (int, error)
}

type SeminarRepository interface {
	ListWithStatus(ctx context.Context, memberID int64) ([]SeminarWithStatus, error)
	// Register enforces capacity and one-registration-per-slot atomically.
	// Returns ErrNotFound, ErrSeminarFull, or ErrAlreadyRegistered.
	Register(ctx context.Context, seminarID, memberID int64) error
	// Unregister removes the member's registration; ErrNotFound when the
	// member is not registered for that seminar.
	Unregister(ctx context.Context, seminarID, memberID int64) error
	CountRegistrationsByMember(ctx context.Context, memberID int64) (int, error)
	CountSlots(ctx context.Context) (int, error)
}
