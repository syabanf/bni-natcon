package domain

import "time"

type Role string

const (
	RoleMember Role = "member"
	RoleTenant Role = "tenant"
	RoleAdmin  Role = "admin"
)

type User struct {
	ID             int64
	Name           string
	Email          string
	PasswordHash   string
	Role           Role
	MemberCode     string // empty for tenant-role users
	Chapter        string
	Company        string
	Phone          string
	Classification string // BNI business classification, from the ticketing export
	// MustSetPassword is true while the account still carries the password
	// generated at import time — the app forces a real one on first sign-in.
	MustSetPassword bool
	// TicketNumber identifies the ticket this account was imported from. One
	// buyer can hold several, which is why members may share an email.
	TicketNumber string
	CreatedAt    time.Time
}

// Tenant kinds: sponsors are listed above booths on the passport.
const (
	TenantKindBooth   = "booth"
	TenantKindSponsor = "sponsor"
)

type Tenant struct {
	ID          int64
	Name        string
	Category    string
	Booth       string
	Initials    string
	Kind        string // "booth" | "sponsor"
	Description string
	// The company's own logo. Empty falls back to the initials, so a booth
	// that never sends artwork still looks deliberate.
	LogoURL string
	// The BNI member manning the booth, and the chapter they belong to.
	ContactName string
	Chapter     string
	OwnerUserID int64
}

// TenantWithVisit is a tenant plus whether a given member has visited it.
type TenantWithVisit struct {
	Tenant
	Visited bool
}

// Visit is the digital stamp: one per (tenant, member) pair.
type Visit struct {
	ID        int64
	TenantID  int64
	MemberID  int64
	CreatedAt time.Time
}

// Visitor is a visit joined with member info, for the booth dashboard.
type Visitor struct {
	MemberID   int64
	Name       string
	Chapter    string
	Company    string
	MemberCode string
	Phone      string
	Note       string
	VisitedAt  time.Time
}

// SeminarSpeaker is one person on stage for a learning class.
const (
	SpeakerRoleSpeaker   = "speaker"
	SpeakerRoleModerator = "moderator"
)

type SeminarSpeaker struct {
	ID       int64
	Name     string
	Role     string // "speaker" | "moderator"
	Title    string
	PhotoURL string
	Sort     int
}

type Seminar struct {
	ID          int64
	Slot        int
	Room        string
	Title       string
	Speaker     string // one or more speakers, comma-separated
	Moderator   string
	Capacity    int
	Description string
	CoverURL    string
	// PosterURL is the portrait poster shown on the class detail page; the
	// landscape CoverURL stays the banner on the list (MoM 19 Aug 2026).
	PosterURL string
	Speakers  []SeminarSpeaker
	// RundownID ties the class to a block of the schedule. Zero means the
	// committee has not placed it yet.
	RundownID int64
	StartsAt  *time.Time
	EndsAt    *time.Time
}

// RedeemResult is what the desk sees after scanning someone for their pin or
// their goodiebag — enough to hand the right thing to the right person, and
// to explain a refusal.
type RedeemResult struct {
	MemberID    int64
	Name        string
	MemberCode  string
	Chapter     string
	Company     string
	Visits      int
	RedeemedAt  time.Time
	AlreadyDone bool
}

// The two things handed over at a desk.
const (
	RedeemPin       = "pin"
	RedeemGoodiebag = "goodiebag"
)

// RundownBlock is one slice of the event's schedule — the one-hour blocks the
// committee fills in (MoM 19 Aug 2026). Learning classes hang off these, and
// the attendee agenda is built from them, so nothing carries its own private
// idea of what time it is.
type RundownBlock struct {
	ID       int64
	StartsAt time.Time
	EndsAt   time.Time
	Title    string
	Place    string
	Kind     string
	Sort     int
}

// Overlaps reports whether two blocks share any moment. Touching edges do not
// count: a block ending at 14:00 and one starting at 14:00 can both be
// attended.
func (b RundownBlock) Overlaps(other RundownBlock) bool {
	return b.StartsAt.Before(other.EndsAt) && other.StartsAt.Before(b.EndsAt)
}

// Rundown block kinds. Only 'learning' blocks can hold a class.
const (
	RundownRegistration = "registration"
	RundownPlenary      = "plenary"
	RundownLearning     = "learning"
	RundownNetworking   = "networking"
	RundownBreak        = "break"
	RundownDoorprize    = "doorprize"
)

// SeminarWithStatus is a seminar plus registration info for a given member.
type SeminarWithStatus struct {
	Seminar
	SeatsTaken int
	Registered bool
	Attended   bool
}

type SeminarRegistration struct {
	ID        int64
	SeminarID int64
	MemberID  int64
	CreatedAt time.Time
}

// MemberStats aggregates the numbers shown on the member home screen.
type MemberStats struct {
	TenantsVisited int
	TenantsTotal   int
	Coupons        int
	SeminarsPicked int
	SeminarsTotal  int
}

// BoothStats aggregates the numbers shown on the tenant dashboard.
type BoothStats struct {
	TotalScans int
	ScansToday int
}

// ScanResult is what the booth scanner shows after scanning a member QR
// (or manually entering a member ID / phone number).
type ScanResult struct {
	MemberID      int64
	MemberName    string
	MemberChapter string
	MemberCompany string
	Duplicate     bool
	Coupons       int // pins collected (one per booth visit)
}

// AdminOverview aggregates event-wide numbers for the admin dashboard.
type AdminOverview struct {
	TotalMembers         int
	TotalTenants         int
	TotalSponsors        int
	TotalBooths          int
	TotalVisits          int
	VisitsToday          int
	SeminarRegistrations int
	MembersWithVisit     int
}

// TenantScanCount ranks a booth by collected scans.
type TenantScanCount struct {
	Tenant
	ScanCount int
}

// SeminarFill is a seminar plus how many seats are taken.
type SeminarFill struct {
	Seminar
	SeatsTaken int
}

// ActivityItem is one scan event across all booths, newest first.
type ActivityItem struct {
	MemberName string
	Chapter    string
	TenantName string
	Booth      string
	VisitedAt  time.Time
}

/* ----- Master data (admin CRUD) ----- */

// Chapter is first-class master data, fed by member imports and CRUD.
type Chapter struct {
	ID      int64
	Name    string
	Members int
}

// UpsertResult reports what a bulk member upsert did to one row.
type UpsertResult struct {
	User    *User
	Created bool
}

// TenantUpsertResult reports what a bulk tenant upsert did to one row.
type TenantUpsertResult struct {
	Tenant  *Tenant
	Created bool
}

// MemberSummary is a member row in the admin master-data table.
type MemberSummary struct {
	User
	Visits int
}

// NewMember carries admin input for creating a member. PasswordHash is set by
// the usecase before it reaches the repository.
type NewMember struct {
	Name           string
	Email          string
	PasswordHash   string
	Chapter        string
	Company        string
	Phone          string
	Classification string
	TicketNumber   string
}

type MemberUpdate struct {
	Name           string
	Email          string
	Chapter        string
	Company        string
	Phone          string
	Classification string
}

// NewTenant creates a booth/sponsor plus its scanner login user.
type NewTenant struct {
	Name         string
	Category     string
	Booth        string
	Initials     string
	Kind         string
	Description  string
	LogoURL      string
	ContactName  string
	Chapter      string
	Email        string
	PasswordHash string
}

type TenantUpdate struct {
	Name        string
	Category    string
	Booth       string
	Initials    string
	Kind        string
	Description string
	LogoURL     string
	ContactName string
	Chapter     string
}

type SeminarInput struct {
	Slot        int
	Room        string
	Title       string
	Speaker     string
	Moderator   string
	Capacity    int
	Description string
	CoverURL    string
	Speakers    []SeminarSpeaker
}

// SeminarQuota is the seat quota of one learning class next to what is
// already booked against it — what the committee needs to see the moment
// they change the number.
type SeminarQuota struct {
	ID         int64
	Capacity   int
	SeatsTaken int
}

// BulkRowError reports why one row of a bulk import failed.
type BulkRowError struct {
	Row   int
	Label string
	Err   string
}

// VisitReportRow is one line of the leads/visits report.
type VisitReportRow struct {
	MemberName string
	MemberCode string
	Chapter    string
	Company    string
	TenantName string
	Booth      string
	VisitedAt  time.Time
}

// RegistrationReportRow is one line of the seminar registration report.
type RegistrationReportRow struct {
	MemberName   string
	MemberCode   string
	Chapter      string
	Slot         int
	Room         string
	SeminarTitle string
	RegisteredAt time.Time
	Attended     bool
}

/* ----- Detail pages (admin) ----- */

type MemberVisitRow struct {
	TenantName string
	Booth      string
	VisitedAt  time.Time
}

type MemberRegRow struct {
	Slot         int
	Room         string
	Title        string
	RegisteredAt time.Time
}

type MemberDetail struct {
	User
	Visits        []MemberVisitRow
	Registrations []MemberRegRow
}

type TenantDetail struct {
	Tenant
	OwnerEmail string
	TotalScans int
	ScansToday int
	Visitors   []Visitor
}

type SeminarAttendee struct {
	Name         string
	MemberCode   string
	Chapter      string
	Company      string
	RegisteredAt time.Time
	CheckedIn    bool
	CheckedInAt  *time.Time
}

type SeminarDetail struct {
	Seminar
	SeatsTaken    int
	AttendedCount int
	Attendees     []SeminarAttendee
}

// RegistrationResult is what the committee sees after booking an attendee
// into a learning class from the admin panel. Duplicate means they were
// already in that same class, which is fine — not an error.
type RegistrationResult struct {
	MemberName    string
	MemberCode    string
	MemberChapter string
	Duplicate     bool
}

// CheckinResult is what the door committee sees after scanning a member QR.
type CheckinResult struct {
	MemberName    string
	MemberCode    string
	MemberChapter string
	Duplicate     bool
	AttendedCount int
}

/* ----- Speed networking ----- */

type NetworkingTable struct {
	ID       int64
	TableNo  int
	Hall     string
	Capacity int
	Occupied int
}

// TableMate is one person seated at the member's table. Note is the
// owner's private note on that person (set after saving the contact).
type TableMate struct {
	MemberID       int64
	Name           string
	Chapter        string
	Company        string
	Classification string
	Phone          string // shown as a WhatsApp link at the table
	SeatNo         int
	IsMe           bool
	Saved          bool
	Note           string
}

// NetworkingStatus is everything the member's networking screen needs.
type NetworkingStatus struct {
	CheckedIn bool
	Table     *NetworkingTable
	SeatNo    int
	Mates     []TableMate
	Tables    []NetworkingTable
}

type TableHistoryRow struct {
	TableNo  int
	Hall     string
	JoinedAt time.Time
}

type SavedContact struct {
	MemberID       int64
	Name           string
	Chapter        string
	Company        string
	Classification string
	MemberCode     string
	Note           string
	SavedAt        time.Time
}

// TableDetail is one networking table plus everyone currently seated there.
type TableDetail struct {
	Table   NetworkingTable
	Members []TableMate
}

// ContactDetail is a saved contact's profile for the history view.
type ContactDetail struct {
	MemberID       int64
	Name           string
	Chapter        string
	Company        string
	MemberCode     string
	Classification string
	Email          string
	Phone          string
	Note           string
	SavedAt        time.Time
	CurrentTableNo int // 0 when not checked in anywhere
}

// NetworkingHistory backs the member's "riwayat" view: which tables they
// joined and every contact they saved.
type NetworkingHistory struct {
	Tables   []TableHistoryRow
	Contacts []SavedContact
}
