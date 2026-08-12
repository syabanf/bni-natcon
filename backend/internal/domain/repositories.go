package domain

import "context"

type UserRepository interface {
	GetByEmail(ctx context.Context, email string) (*User, error)
	// ListByEmail returns every account on an address — members may share one
	// when a buyer holds several tickets.
	ListByEmail(ctx context.Context, email string) ([]*User, error)
	GetByID(ctx context.Context, id int64) (*User, error)
	GetByMemberCode(ctx context.Context, code string) (*User, error)
	// GetByCodeOrPhone resolves a member by member code OR phone number —
	// the booth scanner's manual input accepts either.
	GetByCodeOrPhone(ctx context.Context, key string) (*User, error)
	SetPassword(ctx context.Context, userID int64, hash string) error
	// FindMembersByChapterPhone backs password recovery — chapter plus the
	// phone number on the ticket is what an attendee has to prove. Two tickets
	// bought together share both, so this can return more than one account.
	FindMembersByChapterPhone(ctx context.Context, chapter, phone string) ([]*User, error)
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
	// SetNote stores the booth's private note about a visitor.
	// ErrNotFound when the member never visited this booth.
	SetNote(ctx context.Context, tenantID, memberID int64, note string) error
	// VisitorDetail returns one visitor's profile + note for this booth.
	VisitorDetail(ctx context.Context, tenantID, memberID int64) (*Visitor, error)
}

type AdminRepository interface {
	Overview(ctx context.Context) (*AdminOverview, error)
	TenantRanking(ctx context.Context) ([]TenantScanCount, error)
	SeminarFill(ctx context.Context) ([]SeminarFill, error)
	RecentActivity(ctx context.Context, limit int) ([]ActivityItem, error)

	// SeminarCheckin records door attendance for a registered member.
	// ErrNotFound for unknown seminar/member, ErrNotRegistered when the
	// member never registered; a repeat check-in sets Duplicate instead
	// of failing.
	SeminarCheckin(ctx context.Context, seminarID int64, memberCode string) (*CheckinResult, error)

	// Master data. Create/Update return ErrEmailTaken on duplicate emails;
	// Update/Delete return ErrNotFound for unknown ids. Deletes cascade to
	// dependent rows (visits, registrations, booth login users).
	// ListMembers filters by q (name/email/code/chapter) and paginates;
	// it also returns the total row count for the filter.
	ListMembers(ctx context.Context, q string, limit, offset int) ([]MemberSummary, int, error)
	CreateMember(ctx context.Context, m NewMember) (*User, error)
	// UpsertMember creates the member, or — when the email already belongs
	// to a member — updates name/chapter/company/phone in place (the stored
	// password and member code are kept). ErrEmailTaken when the email
	// belongs to a non-member account.
	UpsertMember(ctx context.Context, m NewMember) (*UpsertResult, error)
	UpdateMember(ctx context.Context, id int64, m MemberUpdate) error
	DeleteMember(ctx context.Context, id int64) error

	CreateTenant(ctx context.Context, t NewTenant) (*Tenant, error)
	// UpsertTenant creates the tenant, or — when the booth code already
	// exists — updates name/category/initials/kind/description in place,
	// keeping the booth's scanner account and its collected scans.
	UpsertTenant(ctx context.Context, t NewTenant) (*TenantUpsertResult, error)
	UpdateTenant(ctx context.Context, id int64, t TenantUpdate) error
	DeleteTenant(ctx context.Context, id int64) error

	CreateSeminar(ctx context.Context, s SeminarInput) (*Seminar, error)
	// RegisterSeminarMember books an attendee (by member code, email, or
	// phone) into a class, enforcing capacity and one class per slot.
	RegisterSeminarMember(ctx context.Context, seminarID int64, lookup string) (*RegistrationResult, error)
	UnregisterSeminarMember(ctx context.Context, seminarID int64, memberCode string) error
	SeminarIDByRoom(ctx context.Context, room string) (int64, error)
	UpdateSeminar(ctx context.Context, id int64, s SeminarInput) error
	// SetSeminarQuota changes only the seat quota, so the committee can
	// re-size a room without the class copy, cover or speaker list riding
	// along. Both this and UpdateSeminar refuse a quota below the seats
	// already booked (ErrInvalidInput) — shrinking a room does not throw
	// anyone out of it.
	SetSeminarQuota(ctx context.Context, id int64, quota int) (*SeminarQuota, error)
	DeleteSeminar(ctx context.Context, id int64) error

	// Chapters master data. EnsureChapter registers a chapter name
	// idempotently; RenameChapter also moves every member carrying the old
	// name; DeleteChapter refuses (ErrInvalidInput) while members still use it.
	ListChapters(ctx context.Context) ([]Chapter, error)
	EnsureChapter(ctx context.Context, name string) error
	CreateChapter(ctx context.Context, name string) (*Chapter, error)
	RenameChapter(ctx context.Context, id int64, name string) error
	DeleteChapter(ctx context.Context, id int64) error

	// Networking tables master data. GenerateTables appends `count` tables,
	// numbering continues after the highest existing table; UpdateTable
	// refuses to shrink below the seats already taken; DeleteTable returns
	// ErrTableInUse while somebody is checked in.
	ListTables(ctx context.Context) ([]NetworkingTable, error)
	GenerateTables(ctx context.Context, count int, hall string, capacity int) ([]NetworkingTable, error)
	UpdateTable(ctx context.Context, id int64, hall string, capacity int) error
	DeleteTable(ctx context.Context, id int64) error

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
	// History returns the member's table check-in log and saved contacts.
	History(ctx context.Context, memberID int64) (*NetworkingHistory, error)
	// TableDetail returns a table plus its current occupants, with saved
	// flags relative to memberID. ErrNotFound for unknown table numbers.
	TableDetail(ctx context.Context, memberID int64, tableNo int) (*TableDetail, error)
	// ContactDetail returns one of the member's saved contacts;
	// ErrNotFound when the contact was never saved by this member.
	ContactDetail(ctx context.Context, ownerID, contactID int64) (*ContactDetail, error)
	// SetContactNote stores the owner's private note about a saved contact.
	// ErrNotFound when the contact was never saved by this member.
	SetContactNote(ctx context.Context, ownerID, contactID int64, note string) error
}

type SeminarRepository interface {
	ListWithStatus(ctx context.Context, memberID int64) ([]SeminarWithStatus, error)
	// Register enforces capacity and one-registration-per-slot atomically.
	// Returns ErrNotFound, ErrSeminarFull, or ErrAlreadyRegistered.
	Register(ctx context.Context, seminarID, memberID int64) error
	// Unregister removes the member's registration; ErrNotFound when the
	// member is not registered for that seminar.
	Unregister(ctx context.Context, seminarID, memberID int64) error
	// Attendees lists who else is in a class, for the attendee-facing view.
	Attendees(ctx context.Context, seminarID int64) ([]SeminarAttendee, error)
	CountRegistrationsByMember(ctx context.Context, memberID int64) (int, error)
	CountSlots(ctx context.Context) (int, error)
}
