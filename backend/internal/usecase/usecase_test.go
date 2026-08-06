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
	uc := NewAuthUsecase(users, fakeTokens{}, fakeVerifier{}, fakeVerifier{})

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
			res, err := uc.Login(context.Background(), tt.email, tt.password)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("err = %v, want %v", err, tt.wantErr)
			}
			if tt.wantErr == nil {
				if res.Token == "" || res.User == nil {
					t.Fatalf("expected token and user, got %q, %v", res.Token, res.User)
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

func TestImportPassword(t *testing.T) {
	cases := []struct {
		chapter, name, want string
	}{
		{"Heritage", "Abraham Sebastian", "heritageabraham"},
		{"Chapter Jakarta Elite", "Reddie Wijaya", "chapterjakartaelitereddie"},
		{"", "Sinta Dewi", "sinta"},
		{"Grow", "", "grow"},
		{"", "", ""},
		{"BNI Ampang, KLCC", "D'Angelo Jr.", "bniampangklccdangelo"},
	}
	for _, c := range cases {
		if got := importPassword(c.chapter, c.name); got != c.want {
			t.Errorf("importPassword(%q, %q) = %q, want %q", c.chapter, c.name, got, c.want)
		}
	}
}

func TestSetPassword(t *testing.T) {
	member := newMember(1, "NATCON-2026-00001")
	member.MustSetPassword = true
	users := &fakeUserRepo{users: []*domain.User{member}}
	uc := NewAuthUsecase(users, fakeTokens{}, fakeVerifier{}, fakeVerifier{})
	ctx := context.Background()

	if err := uc.SetPassword(ctx, 1, "short"); err == nil {
		t.Fatal("a 5-character password should be rejected")
	}
	if err := uc.SetPassword(ctx, 1, "brandnewpass"); err != nil {
		t.Fatalf("set password: %v", err)
	}
	if member.MustSetPassword {
		t.Fatal("the first-login flag should be cleared once a password is set")
	}
	if _, err := uc.Login(ctx, "member@test.id", "brandnewpass"); err != nil {
		t.Fatalf("login with the new password: %v", err)
	}
	if _, err := uc.Login(ctx, "member@test.id", "secret"); !errors.Is(err, domain.ErrInvalidCredentials) {
		t.Fatal("the old generated password should no longer work")
	}
}

func TestForgotAndResetPassword(t *testing.T) {
	member := newMember(1, "NATCON-2026-00001")
	member.Chapter = "Chapter Test"
	member.Phone = "+628111000154"
	users := &fakeUserRepo{users: []*domain.User{member}}
	uc := NewAuthUsecase(users, fakeTokens{}, fakeVerifier{}, fakeVerifier{})
	ctx := context.Background()

	// The phone can arrive in any of the shapes the ticketing sheet carries,
	// and the chapter match ignores case and spacing.
	for _, phone := range []string{"+628111000154", "08111000154", "8111000154"} {
		if _, err := uc.ForgotPassword(ctx, "chaptertest", phone); err != nil {
			t.Fatalf("forgot with phone %q: %v", phone, err)
		}
	}
	if _, err := uc.ForgotPassword(ctx, "Chapter Test", "+628990000000"); !errors.Is(err, domain.ErrInvalidCredentials) {
		t.Fatal("a phone that belongs to nobody must not resolve")
	}
	if _, err := uc.ForgotPassword(ctx, "Wrong Chapter", "+628111000154"); !errors.Is(err, domain.ErrInvalidCredentials) {
		t.Fatal("the right phone under the wrong chapter must not resolve")
	}

	found, err := uc.ForgotPassword(ctx, "Chapter Test", "+628111000154")
	if err != nil {
		t.Fatalf("forgot: %v", err)
	}
	if len(found) != 1 || found[0].User.ID != 1 {
		t.Fatalf("resolved the wrong member: %+v", found)
	}
	token := found[0].ResetToken
	if err := uc.ResetPassword(ctx, "not-a-token", "brandnewpass"); err == nil {
		t.Fatal("a bogus reset token should be refused")
	}
	if err := uc.ResetPassword(ctx, token, "brandnewpass"); err != nil {
		t.Fatalf("reset: %v", err)
	}
	if _, err := uc.Login(ctx, "member@test.id", "brandnewpass"); err != nil {
		t.Fatalf("login after reset: %v", err)
	}
}

func TestLoginPicksBetweenTicketsOnOneEmail(t *testing.T) {
	// A buyer holding two tickets: two attendee accounts, one address.
	first := newMember(1, "NATCON-2026-00001")
	second := newMember(2, "NATCON-2026-00002")
	second.Name = "Second Ticket"
	second.PasswordHash = "hash:othersecret"
	users := &fakeUserRepo{users: []*domain.User{first, second}}
	uc := NewAuthUsecase(users, fakeTokens{}, fakeVerifier{}, fakeVerifier{})
	ctx := context.Background()

	// Different passwords: only the account that password opens is signed in.
	res, err := uc.Login(ctx, "member@test.id", "othersecret")
	if err != nil {
		t.Fatalf("login: %v", err)
	}
	if res.Choice != "" || res.User.ID != 2 {
		t.Fatalf("expected a straight sign-in as account 2, got %+v", res)
	}

	// Same password on both (they were imported together and neither has
	// chosen one yet): the attendee is asked which ticket they are.
	second.PasswordHash = first.PasswordHash
	res, err = uc.Login(ctx, "member@test.id", "secret")
	if err != nil {
		t.Fatalf("login: %v", err)
	}
	if res.Choice == "" || len(res.Accounts) != 2 || res.Token != "" {
		t.Fatalf("expected a choice between two accounts, got %+v", res)
	}

	session, err := uc.SelectAccount(ctx, res.Choice, 2)
	if err != nil {
		t.Fatalf("select: %v", err)
	}
	if session.Token == "" || session.User.ID != 2 {
		t.Fatalf("expected a session for account 2, got %+v", session)
	}

	// The choice token only opens the accounts it was issued for.
	if _, err := uc.SelectAccount(ctx, res.Choice, 99); !errors.Is(err, domain.ErrInvalidCredentials) {
		t.Fatal("a choice token must not sign in an account it never listed")
	}
	if _, err := uc.SelectAccount(ctx, "not-a-token", 2); err == nil {
		t.Fatal("a bogus choice token should be refused")
	}
}

func TestForgotPasswordListsEveryTicket(t *testing.T) {
	first := newMember(1, "NATCON-2026-00001")
	first.Chapter, first.Phone = "Chapter Test", "+628111000154"
	second := newMember(2, "NATCON-2026-00002")
	second.Name, second.Chapter, second.Phone = "Second Ticket", "Chapter Test", "+628111000154"
	users := &fakeUserRepo{users: []*domain.User{first, second}}
	uc := NewAuthUsecase(users, fakeTokens{}, fakeVerifier{}, fakeVerifier{})

	found, err := uc.ForgotPassword(context.Background(), "Chapter Test", "08111000154")
	if err != nil {
		t.Fatalf("forgot: %v", err)
	}
	if len(found) != 2 {
		t.Fatalf("both tickets should be offered, got %d", len(found))
	}
	// Each account gets its own token, so resetting one leaves the other alone.
	if found[0].ResetToken == found[1].ResetToken {
		t.Fatal("each account needs its own reset token")
	}
}
