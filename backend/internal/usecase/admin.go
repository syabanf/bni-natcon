package usecase

import (
	"context"
	"fmt"
	"net/mail"
	"strings"

	"natcon2026/backend/internal/domain"
)

func validEmail(email string) bool {
	addr, err := mail.ParseAddress(email)
	return err == nil && addr.Address == email
}

// PasswordHasher abstracts bcrypt hashing for admin-created accounts.
type PasswordHasher interface {
	Hash(password string) (string, error)
}

type AdminUsecase struct {
	admin           domain.AdminRepository
	hasher          PasswordHasher
	defaultPassword string
}

func NewAdminUsecase(admin domain.AdminRepository, hasher PasswordHasher, defaultPassword string) *AdminUsecase {
	return &AdminUsecase{admin: admin, hasher: hasher, defaultPassword: defaultPassword}
}

func (u *AdminUsecase) Overview(ctx context.Context) (*domain.AdminOverview, error) {
	return u.admin.Overview(ctx)
}

func (u *AdminUsecase) TenantRanking(ctx context.Context) ([]domain.TenantScanCount, error) {
	return u.admin.TenantRanking(ctx)
}

func (u *AdminUsecase) SeminarFill(ctx context.Context) ([]domain.SeminarFill, error) {
	return u.admin.SeminarFill(ctx)
}

func (u *AdminUsecase) RecentActivity(ctx context.Context, limit int) ([]domain.ActivityItem, error) {
	if limit <= 0 || limit > 100 {
		limit = 30
	}
	return u.admin.RecentActivity(ctx, limit)
}

/* ----- Master data ----- */

func invalid(msg string) error {
	return fmt.Errorf("%w: %s", domain.ErrInvalidInput, msg)
}

func (u *AdminUsecase) ListMembers(ctx context.Context, q string, page, limit int) ([]domain.MemberSummary, int, error) {
	if limit <= 0 || limit > 1000 {
		limit = 50
	}
	if page <= 0 {
		page = 1
	}
	return u.admin.ListMembers(ctx, strings.TrimSpace(q), limit, (page-1)*limit)
}

func (u *AdminUsecase) SeminarCheckin(ctx context.Context, seminarID int64, memberCode string) (*domain.CheckinResult, error) {
	memberCode = strings.TrimSpace(memberCode)
	if memberCode == "" {
		return nil, invalid("member code is required")
	}
	return u.admin.SeminarCheckin(ctx, seminarID, memberCode)
}

func (u *AdminUsecase) CreateMember(ctx context.Context, name, email, password, chapter, company, phone string) (*domain.User, error) {
	name, email = strings.TrimSpace(name), strings.ToLower(strings.TrimSpace(email))
	if name == "" || email == "" {
		return nil, invalid("name and email are required")
	}
	if !validEmail(email) {
		return nil, invalid("invalid email format")
	}
	if password == "" {
		password = u.defaultPassword
	}
	hash, err := u.hasher.Hash(password)
	if err != nil {
		return nil, err
	}
	return u.admin.CreateMember(ctx, domain.NewMember{
		Name: name, Email: email, PasswordHash: hash,
		Chapter: strings.TrimSpace(chapter), Company: strings.TrimSpace(company),
		Phone: strings.TrimSpace(phone),
	})
}

func (u *AdminUsecase) UpdateMember(ctx context.Context, id int64, m domain.MemberUpdate) error {
	m.Name, m.Email = strings.TrimSpace(m.Name), strings.ToLower(strings.TrimSpace(m.Email))
	if m.Name == "" || m.Email == "" {
		return invalid("name and email are required")
	}
	if !validEmail(m.Email) {
		return invalid("invalid email format")
	}
	m.Phone = strings.TrimSpace(m.Phone)
	return u.admin.UpdateMember(ctx, id, m)
}

func (u *AdminUsecase) DeleteMember(ctx context.Context, id int64) error {
	return u.admin.DeleteMember(ctx, id)
}

func (u *AdminUsecase) CreateTenant(ctx context.Context, name, category, booth, initials, email, password, kind, description string) (*domain.Tenant, error) {
	name, booth = strings.TrimSpace(name), strings.TrimSpace(booth)
	if name == "" || booth == "" {
		return nil, invalid("name and booth are required")
	}
	kind = normalizeTenantKind(kind)
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" {
		email = fmt.Sprintf("booth-%s@natcon.id",
			strings.ToLower(strings.ReplaceAll(booth, "-", "")))
	} else if !validEmail(email) {
		return nil, invalid("invalid email format")
	}
	if initials == "" {
		for _, w := range strings.Fields(name) {
			initials += string([]rune(w)[0])
		}
		if len(initials) > 2 {
			initials = initials[:2]
		}
		initials = strings.ToUpper(initials)
	}
	if password == "" {
		password = u.defaultPassword
	}
	hash, err := u.hasher.Hash(password)
	if err != nil {
		return nil, err
	}
	return u.admin.CreateTenant(ctx, domain.NewTenant{
		Name: name, Category: strings.TrimSpace(category), Booth: booth,
		Initials: strings.ToUpper(strings.TrimSpace(initials)), Kind: kind,
		Description: strings.TrimSpace(description), Email: email, PasswordHash: hash,
	})
}

func normalizeTenantKind(kind string) string {
	if strings.EqualFold(strings.TrimSpace(kind), domain.TenantKindSponsor) {
		return domain.TenantKindSponsor
	}
	return domain.TenantKindBooth
}

func (u *AdminUsecase) UpdateTenant(ctx context.Context, id int64, t domain.TenantUpdate) error {
	t.Name, t.Booth = strings.TrimSpace(t.Name), strings.TrimSpace(t.Booth)
	if t.Name == "" || t.Booth == "" {
		return invalid("name and booth are required")
	}
	t.Initials = strings.ToUpper(strings.TrimSpace(t.Initials))
	t.Kind = normalizeTenantKind(t.Kind)
	t.Description = strings.TrimSpace(t.Description)
	return u.admin.UpdateTenant(ctx, id, t)
}

func (u *AdminUsecase) DeleteTenant(ctx context.Context, id int64) error {
	return u.admin.DeleteTenant(ctx, id)
}

func (u *AdminUsecase) CreateSeminar(ctx context.Context, s domain.SeminarInput) (*domain.Seminar, error) {
	if err := validateSeminar(&s); err != nil {
		return nil, err
	}
	return u.admin.CreateSeminar(ctx, s)
}

func (u *AdminUsecase) UpdateSeminar(ctx context.Context, id int64, s domain.SeminarInput) error {
	if err := validateSeminar(&s); err != nil {
		return err
	}
	return u.admin.UpdateSeminar(ctx, id, s)
}

func (u *AdminUsecase) DeleteSeminar(ctx context.Context, id int64) error {
	return u.admin.DeleteSeminar(ctx, id)
}

/* ----- Bulk import ----- */

type MemberImportRow struct {
	Name    string
	Email   string
	Chapter string
	Company string
	Phone   string
}

func (u *AdminUsecase) BulkCreateMembers(ctx context.Context, rows []MemberImportRow) (int, []domain.BulkRowError) {
	created := 0
	var errs []domain.BulkRowError
	for i, row := range rows {
		if _, err := u.CreateMember(ctx, row.Name, row.Email, "", row.Chapter, row.Company, row.Phone); err != nil {
			errs = append(errs, domain.BulkRowError{Row: i + 1, Label: row.Email, Err: err.Error()})
			continue
		}
		created++
	}
	return created, errs
}

type TenantImportRow struct {
	Name     string
	Category string
	Booth    string
	Initials string
	Email    string
	Kind     string
}

func (u *AdminUsecase) BulkCreateTenants(ctx context.Context, rows []TenantImportRow) (int, []domain.BulkRowError) {
	created := 0
	var errs []domain.BulkRowError
	for i, row := range rows {
		if _, err := u.CreateTenant(ctx, row.Name, row.Category, row.Booth, row.Initials, row.Email, "", row.Kind, ""); err != nil {
			errs = append(errs, domain.BulkRowError{Row: i + 1, Label: row.Name, Err: err.Error()})
			continue
		}
		created++
	}
	return created, errs
}

/* ----- Detail pages ----- */

func (u *AdminUsecase) MemberDetail(ctx context.Context, id int64) (*domain.MemberDetail, error) {
	return u.admin.MemberDetail(ctx, id)
}

func (u *AdminUsecase) TenantDetail(ctx context.Context, id int64) (*domain.TenantDetail, error) {
	return u.admin.TenantDetail(ctx, id)
}

func (u *AdminUsecase) SeminarDetail(ctx context.Context, id int64) (*domain.SeminarDetail, error) {
	return u.admin.SeminarDetail(ctx, id)
}

/* ----- Reports ----- */

func (u *AdminUsecase) VisitReport(ctx context.Context) ([]domain.VisitReportRow, error) {
	return u.admin.VisitReport(ctx)
}

func (u *AdminUsecase) RegistrationReport(ctx context.Context) ([]domain.RegistrationReportRow, error) {
	return u.admin.RegistrationReport(ctx)
}

func validateSeminar(s *domain.SeminarInput) error {
	s.Room, s.Title = strings.TrimSpace(s.Room), strings.TrimSpace(s.Title)
	s.Speaker = strings.TrimSpace(s.Speaker)
	if s.Room == "" || s.Title == "" {
		return invalid("room and title are required")
	}
	if s.Capacity <= 0 {
		return invalid("capacity must be greater than 0")
	}
	if s.Slot <= 0 {
		s.Slot = 1
	}
	return nil
}
