package usecase

import (
	"context"
	"errors"
	"testing"

	"natcon2026/backend/internal/domain"
)

func newMember(id int64, code string) *domain.User {
	return &domain.User{
		ID: id, Name: "Member", Email: "member@test.id",
		PasswordHash: "hash:secret", Role: domain.RoleMember,
		MemberCode: code, Chapter: "Chapter Test",
	}
}

func TestAuthLogin(t *testing.T) {
	users := &fakeUserRepo{users: []*domain.User{newMember(1, "NATCON-2026-00001")}}
	uc := NewAuthUsecase(users, fakeTokens{}, fakeVerifier{})

	tests := []struct {
		name     string
		email    string
		password string
		wantErr  error
	}{
		{"valid credentials", "member@test.id", "secret", nil},
		{"email is case-insensitive and trimmed", "  Member@Test.id ", "secret", nil},
		{"wrong password", "member@test.id", "nope", domain.ErrInvalidCredentials},
		{"unknown email", "ghost@test.id", "secret", domain.ErrInvalidCredentials},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			token, user, err := uc.Login(context.Background(), tt.email, tt.password)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("err = %v, want %v", err, tt.wantErr)
			}
			if tt.wantErr == nil {
				if token == "" || user == nil {
					t.Fatalf("expected token and user, got %q, %v", token, user)
				}
			}
		})
	}
}

func TestScan(t *testing.T) {
	member := newMember(1, "NATCON-2026-00001")
	tenantOwner := &domain.User{ID: 10, Role: domain.RoleTenant}
	visits := &fakeVisitRepo{}
	tenants := &fakeTenantRepo{
		tenants: []domain.Tenant{{ID: 100, Name: "Kopi Nusantara", OwnerUserID: 10}},
		visits:  visits,
	}
	users := &fakeUserRepo{users: []*domain.User{member, tenantOwner}}
	uc := NewScanUsecase(users, tenants, visits)

	// First scan records the visit and grants a coupon.
	res, err := uc.Scan(context.Background(), 10, "NATCON-2026-00001")
	if err != nil {
		t.Fatalf("first scan: %v", err)
	}
	if res.Duplicate {
		t.Fatal("first scan flagged duplicate")
	}
	if res.Coupons != 1 {
		t.Fatalf("coupons = %d, want 1", res.Coupons)
	}

	// Second scan of the same member at the same booth is a duplicate, not an error.
	res, err = uc.Scan(context.Background(), 10, "NATCON-2026-00001")
	if err != nil {
		t.Fatalf("duplicate scan: %v", err)
	}
	if !res.Duplicate {
		t.Fatal("second scan not flagged duplicate")
	}
	if res.Coupons != 1 {
		t.Fatalf("coupons after duplicate = %d, want 1", res.Coupons)
	}

	// Unknown member code.
	if _, err := uc.Scan(context.Background(), 10, "NATCON-2026-99999"); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("unknown code err = %v, want ErrNotFound", err)
	}

	// Scanner user without a booth.
	if _, err := uc.Scan(context.Background(), 999, "NATCON-2026-00001"); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("no-booth err = %v, want ErrNotFound", err)
	}
}

func TestMemberProfileStats(t *testing.T) {
	member := newMember(1, "NATCON-2026-00001")
	visits := &fakeVisitRepo{}
	tenants := &fakeTenantRepo{
		tenants: []domain.Tenant{
			{ID: 100, OwnerUserID: 10}, {ID: 101, OwnerUserID: 11}, {ID: 102, OwnerUserID: 12},
		},
		visits: visits,
	}
	seminars := &fakeSeminarRepo{seminars: []domain.Seminar{
		{ID: 1, Slot: 1, Capacity: 2}, {ID: 2, Slot: 1, Capacity: 2},
	}}
	users := &fakeUserRepo{users: []*domain.User{member}}
	uc := NewMemberUsecase(users, tenants, visits, seminars)

	if _, _, err := uc.Profile(context.Background(), 1); err != nil {
		t.Fatalf("profile: %v", err)
	}

	// Two visits + one seminar registration.
	if _, err := visits.Create(context.Background(), 100, 1); err != nil {
		t.Fatal(err)
	}
	if _, err := visits.Create(context.Background(), 101, 1); err != nil {
		t.Fatal(err)
	}
	if err := seminars.Register(context.Background(), 1, 1); err != nil {
		t.Fatal(err)
	}

	_, stats, err := uc.Profile(context.Background(), 1)
	if err != nil {
		t.Fatalf("profile: %v", err)
	}
	if stats.TenantsVisited != 2 || stats.Coupons != 2 {
		t.Fatalf("visited/coupons = %d/%d, want 2/2", stats.TenantsVisited, stats.Coupons)
	}
	if stats.TenantsTotal != 3 {
		t.Fatalf("tenants total = %d, want 3", stats.TenantsTotal)
	}
	if stats.SeminarsPicked != 1 || stats.SeminarsTotal != 1 {
		t.Fatalf("seminars picked/total = %d/%d, want 1/1", stats.SeminarsPicked, stats.SeminarsTotal)
	}
}

func TestSeminarRegister(t *testing.T) {
	repo := &fakeSeminarRepo{seminars: []domain.Seminar{
		{ID: 1, Slot: 1, Room: "Merapi", Capacity: 1},
		{ID: 2, Slot: 1, Room: "Rinjani", Capacity: 2},
	}}
	uc := NewSeminarUsecase(repo)
	ctx := context.Background()

	if err := uc.Register(ctx, 1, 100); err != nil {
		t.Fatalf("register: %v", err)
	}
	// Same member cannot pick another seminar in the same slot.
	if err := uc.Register(ctx, 2, 100); !errors.Is(err, domain.ErrAlreadyRegistered) {
		t.Fatalf("same-slot err = %v, want ErrAlreadyRegistered", err)
	}
	// Capacity of seminar 1 is exhausted for the next member.
	if err := uc.Register(ctx, 1, 101); !errors.Is(err, domain.ErrSeminarFull) {
		t.Fatalf("full err = %v, want ErrSeminarFull", err)
	}
	// Unknown seminar.
	if err := uc.Register(ctx, 99, 101); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("unknown err = %v, want ErrNotFound", err)
	}

	list, err := uc.List(ctx, 100)
	if err != nil {
		t.Fatal(err)
	}
	if !list[0].Registered || list[0].SeatsTaken != 1 {
		t.Fatalf("list[0] = %+v, want registered with 1 seat taken", list[0])
	}
}

func TestSeminarUnregisterThenSwitch(t *testing.T) {
	repo := &fakeSeminarRepo{seminars: []domain.Seminar{
		{ID: 1, Slot: 1, Room: "Merapi", Capacity: 5},
		{ID: 2, Slot: 1, Room: "Rinjani", Capacity: 5},
	}}
	uc := NewSeminarUsecase(repo)
	ctx := context.Background()

	if err := uc.Register(ctx, 1, 100); err != nil {
		t.Fatalf("register: %v", err)
	}
	// Cancel, then the same slot opens up for another seminar.
	if err := uc.Unregister(ctx, 1, 100); err != nil {
		t.Fatalf("unregister: %v", err)
	}
	if err := uc.Register(ctx, 2, 100); err != nil {
		t.Fatalf("register other after cancel: %v", err)
	}
	// Cancelling a seminar the member never joined is ErrNotFound.
	if err := uc.Unregister(ctx, 1, 100); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("unregister not-registered err = %v, want ErrNotFound", err)
	}

	list, err := uc.List(ctx, 100)
	if err != nil {
		t.Fatal(err)
	}
	if list[0].Registered || !list[1].Registered {
		t.Fatalf("expected only seminar 2 registered, got %+v", list)
	}
}
