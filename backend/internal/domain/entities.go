package domain

import "time"

type Role string

const (
	RoleMember Role = "member"
	RoleTenant Role = "tenant"
)

type User struct {
	ID           int64
	Name         string
	Email        string
	PasswordHash string
	Role         Role
	MemberCode   string // empty for tenant-role users
	Chapter      string
	Company      string
	CreatedAt    time.Time
}

type Tenant struct {
	ID          int64
	Name        string
	Category    string
	Booth       string
	Initials    string
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
	Name      string
	Chapter   string
	Company   string
	VisitedAt time.Time
}

type Seminar struct {
	ID       int64
	Slot     int
	Room     string
	Title    string
	Speaker  string
	Capacity int
}

// SeminarWithStatus is a seminar plus registration info for a given member.
type SeminarWithStatus struct {
	Seminar
	SeatsTaken int
	Registered bool
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

// ScanResult is what the booth scanner shows after scanning a member QR.
type ScanResult struct {
	MemberName    string
	MemberChapter string
	MemberCompany string
	Duplicate     bool
	Coupons       int
}
