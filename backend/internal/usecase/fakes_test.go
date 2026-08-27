package usecase

import (
	"context"
	"fmt"
	"strings"
	"time"

	"natcon2026/backend/internal/domain"
)

/* In-memory fakes used across usecase tests. */

type fakeUserRepo struct {
	users []*domain.User
}

func (f *fakeUserRepo) GetByEmail(_ context.Context, email string) (*domain.User, error) {
	for _, u := range f.users {
		if u.Email == email {
			return u, nil
		}
	}
	return nil, domain.ErrNotFound
}

func (f *fakeUserRepo) GetByID(_ context.Context, id int64) (*domain.User, error) {
	for _, u := range f.users {
		if u.ID == id {
			return u, nil
		}
	}
	return nil, domain.ErrNotFound
}

func (f *fakeUserRepo) SetPassword(_ context.Context, userID int64, hash string) error {
	for _, u := range f.users {
		if u.ID == userID {
			u.PasswordHash = hash
			u.MustSetPassword = false
			return nil
		}
	}
	return domain.ErrNotFound
}

func (f *fakeUserRepo) RecordConsent(_ context.Context, userID int64) error {
	for _, u := range f.users {
		if u.ID == userID {
			// First answer wins, the way COALESCE does in the real repo.
			if u.ConsentedAt == nil {
				now := time.Now()
				u.ConsentedAt = &now
			}
			return nil
		}
	}
	return domain.ErrNotFound
}

func (f *fakeUserRepo) FindMembersByChapterPhone(_ context.Context, chapter, phone string) ([]*domain.User, error) {
	norm := func(s string) string {
		return strings.ToLower(strings.ReplaceAll(s, " ", ""))
	}
	digits := func(s string) string {
		out := ""
		for _, r := range s {
			if r >= '0' && r <= '9' {
				out += string(r)
			}
		}
		if len(out) > 9 {
			out = out[len(out)-9:]
		}
		return out
	}
	var out []*domain.User
	for _, u := range f.users {
		if u.Role == domain.RoleMember && norm(u.Chapter) == norm(chapter) &&
			u.Phone != "" && digits(u.Phone) == digits(phone) {
			out = append(out, u)
		}
	}
	if len(out) == 0 {
		return nil, domain.ErrNotFound
	}
	return out, nil
}

func (f *fakeUserRepo) ListByEmail(_ context.Context, email string) ([]*domain.User, error) {
	var out []*domain.User
	for _, u := range f.users {
		if u.Email == email {
			out = append(out, u)
		}
	}
	if len(out) == 0 {
		return nil, domain.ErrNotFound
	}
	return out, nil
}

func (f *fakeUserRepo) GetByScanCode(_ context.Context, key string) (*domain.User, error) {
	for _, u := range f.users {
		if u.Role == domain.RoleMember &&
			((u.TicketNumber != "" && u.TicketNumber == key) ||
				u.MemberCode == key || (u.Phone != "" && u.Phone == key)) {
			return u, nil
		}
	}
	return nil, domain.ErrNotFound
}

type fakeTenantRepo struct {
	tenants []domain.Tenant
	visits  *fakeVisitRepo
}

func (f *fakeTenantRepo) ListWithVisits(_ context.Context, memberID int64) ([]domain.TenantWithVisit, error) {
	out := make([]domain.TenantWithVisit, 0, len(f.tenants))
	for _, t := range f.tenants {
		visited := false
		if f.visits != nil {
			for _, v := range f.visits.visits {
				if v.TenantID == t.ID && v.MemberID == memberID {
					visited = true
				}
			}
		}
		out = append(out, domain.TenantWithVisit{Tenant: t, Visited: visited})
	}
	return out, nil
}

func (f *fakeTenantRepo) GetByOwnerUserID(_ context.Context, ownerUserID int64) (*domain.Tenant, error) {
	for _, t := range f.tenants {
		if t.OwnerUserID == ownerUserID {
			tt := t
			return &tt, nil
		}
	}
	return nil, domain.ErrNotFound
}

func (f *fakeTenantRepo) Count(_ context.Context) (int, error) {
	return len(f.tenants), nil
}

type fakeVisitRepo struct {
	visits []domain.Visit
}

func (f *fakeVisitRepo) Create(_ context.Context, tenantID, memberID int64) (*domain.Visit, error) {
	for _, v := range f.visits {
		if v.TenantID == tenantID && v.MemberID == memberID {
			return nil, domain.ErrDuplicateVisit
		}
	}
	v := domain.Visit{ID: int64(len(f.visits) + 1), TenantID: tenantID, MemberID: memberID, CreatedAt: time.Now()}
	f.visits = append(f.visits, v)
	return &v, nil
}

func (f *fakeVisitRepo) CountByMember(_ context.Context, memberID int64) (int, error) {
	n := 0
	for _, v := range f.visits {
		if v.MemberID == memberID {
			n++
		}
	}
	return n, nil
}

func (f *fakeVisitRepo) StatsByTenant(_ context.Context, tenantID int64) (*domain.BoothStats, error) {
	s := &domain.BoothStats{}
	for _, v := range f.visits {
		if v.TenantID == tenantID {
			s.TotalScans++
			s.ScansToday++
		}
	}
	return s, nil
}

func (f *fakeVisitRepo) RecentVisitors(_ context.Context, tenantID int64, limit int) ([]domain.Visitor, error) {
	var out []domain.Visitor
	for i := len(f.visits) - 1; i >= 0 && len(out) < limit; i-- {
		if f.visits[i].TenantID == tenantID {
			out = append(out, domain.Visitor{VisitedAt: f.visits[i].CreatedAt})
		}
	}
	return out, nil
}

func (f *fakeVisitRepo) SetNote(_ context.Context, tenantID, memberID int64, note string) error {
	for _, v := range f.visits {
		if v.TenantID == tenantID && v.MemberID == memberID {
			return nil
		}
	}
	return domain.ErrNotFound
}

func (f *fakeVisitRepo) VisitorDetail(_ context.Context, tenantID, memberID int64) (*domain.Visitor, error) {
	for _, v := range f.visits {
		if v.TenantID == tenantID && v.MemberID == memberID {
			return &domain.Visitor{MemberID: memberID, VisitedAt: v.CreatedAt}, nil
		}
	}
	return nil, domain.ErrNotFound
}

type fakeSeminarRepo struct {
	seminars      []domain.Seminar
	registrations []domain.SeminarRegistration
}

func (f *fakeSeminarRepo) ListWithStatus(_ context.Context, memberID int64) ([]domain.SeminarWithStatus, error) {
	out := make([]domain.SeminarWithStatus, 0, len(f.seminars))
	for _, s := range f.seminars {
		st := domain.SeminarWithStatus{Seminar: s}
		for _, r := range f.registrations {
			if r.SeminarID == s.ID {
				st.SeatsTaken++
				if r.MemberID == memberID {
					st.Registered = true
				}
			}
		}
		out = append(out, st)
	}
	return out, nil
}

func (f *fakeSeminarRepo) Register(_ context.Context, seminarID, memberID int64) error {
	var target *domain.Seminar
	for i := range f.seminars {
		if f.seminars[i].ID == seminarID {
			target = &f.seminars[i]
		}
	}
	if target == nil {
		return domain.ErrNotFound
	}
	taken := 0
	for _, r := range f.registrations {
		if r.SeminarID == seminarID {
			taken++
		}
		for _, s := range f.seminars {
			if s.ID == r.SeminarID && s.Slot == target.Slot && r.MemberID == memberID {
				return domain.ErrAlreadyRegistered
			}
		}
	}
	if taken >= target.Capacity {
		return domain.ErrSeminarFull
	}
	f.registrations = append(f.registrations, domain.SeminarRegistration{
		ID: int64(len(f.registrations) + 1), SeminarID: seminarID, MemberID: memberID,
	})
	return nil
}

func (f *fakeSeminarRepo) Unregister(_ context.Context, seminarID, memberID int64) error {
	for i, r := range f.registrations {
		if r.SeminarID == seminarID && r.MemberID == memberID {
			f.registrations = append(f.registrations[:i], f.registrations[i+1:]...)
			return nil
		}
	}
	return domain.ErrNotFound
}

func (f *fakeSeminarRepo) Attendees(_ context.Context, seminarID int64) ([]domain.SeminarAttendee, error) {
	var out []domain.SeminarAttendee
	for _, r := range f.registrations {
		if r.SeminarID == seminarID {
			out = append(out, domain.SeminarAttendee{MemberCode: fmt.Sprint(r.MemberID)})
		}
	}
	return out, nil
}

func (f *fakeSeminarRepo) CountRegistrationsByMember(_ context.Context, memberID int64) (int, error) {
	n := 0
	for _, r := range f.registrations {
		if r.MemberID == memberID {
			n++
		}
	}
	return n, nil
}

func (f *fakeSeminarRepo) CountSlots(_ context.Context) (int, error) {
	slots := map[int]bool{}
	for _, s := range f.seminars {
		slots[s.Slot] = true
	}
	return len(slots), nil
}

/* Auth helpers */

type fakeTokens struct{}

func (fakeTokens) Issue(userID int64, role domain.Role) (string, error) {
	return "token-for-test", nil
}

func (fakeTokens) IssueReset(userID int64) (string, error) {
	return fmt.Sprintf("reset:%d", userID), nil
}

func (fakeTokens) IssueChoice(userIDs []int64) (string, error) {
	parts := make([]string, 0, len(userIDs))
	for _, id := range userIDs {
		parts = append(parts, fmt.Sprint(id))
	}
	return "choice:" + strings.Join(parts, ","), nil
}

func (fakeTokens) ParseChoice(token string) ([]int64, error) {
	rest, ok := strings.CutPrefix(token, "choice:")
	if !ok || rest == "" {
		return nil, fmt.Errorf("invalid choice token")
	}
	var out []int64
	for _, p := range strings.Split(rest, ",") {
		var id int64
		if _, err := fmt.Sscanf(p, "%d", &id); err != nil {
			return nil, fmt.Errorf("invalid choice token")
		}
		out = append(out, id)
	}
	return out, nil
}

func (fakeTokens) ParseReset(token string) (int64, error) {
	var id int64
	if _, err := fmt.Sscanf(token, "reset:%d", &id); err != nil {
		return 0, fmt.Errorf("invalid reset token")
	}
	return id, nil
}

type fakeVerifier struct{}

// Verify treats the stored hash as "hash:<password>".
func (fakeVerifier) Verify(hash, password string) bool {
	return hash == "hash:"+password
}

// Hash mirrors fakeVerifier so a set password verifies afterwards.
func (fakeVerifier) Hash(password string) (string, error) {
	return "hash:" + password, nil
}
