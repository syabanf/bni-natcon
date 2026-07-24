package usecase

import (
	"context"
	"fmt"
	"strings"

	"natcon2026/backend/internal/domain"
)

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

func (u *AdminUsecase) ListMembers(ctx context.Context) ([]domain.MemberSummary, error) {
	return u.admin.ListMembers(ctx)
}

func (u *AdminUsecase) CreateMember(ctx context.Context, name, email, password, chapter, company string) (*domain.User, error) {
	name, email = strings.TrimSpace(name), strings.ToLower(strings.TrimSpace(email))
	if name == "" || email == "" {
		return nil, invalid("nama dan email wajib diisi")
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
	})
}

func (u *AdminUsecase) UpdateMember(ctx context.Context, id int64, m domain.MemberUpdate) error {
	m.Name, m.Email = strings.TrimSpace(m.Name), strings.ToLower(strings.TrimSpace(m.Email))
	if m.Name == "" || m.Email == "" {
		return invalid("nama dan email wajib diisi")
	}
	return u.admin.UpdateMember(ctx, id, m)
}

func (u *AdminUsecase) DeleteMember(ctx context.Context, id int64) error {
	return u.admin.DeleteMember(ctx, id)
}

func (u *AdminUsecase) CreateTenant(ctx context.Context, name, category, booth, initials, email, password string) (*domain.Tenant, error) {
	name, booth = strings.TrimSpace(name), strings.TrimSpace(booth)
	if name == "" || booth == "" {
		return nil, invalid("nama dan booth wajib diisi")
	}
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" {
		email = fmt.Sprintf("booth-%s@natcon.id",
			strings.ToLower(strings.ReplaceAll(booth, "-", "")))
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
		Initials: strings.ToUpper(strings.TrimSpace(initials)), Email: email, PasswordHash: hash,
	})
}

func (u *AdminUsecase) UpdateTenant(ctx context.Context, id int64, t domain.TenantUpdate) error {
	t.Name, t.Booth = strings.TrimSpace(t.Name), strings.TrimSpace(t.Booth)
	if t.Name == "" || t.Booth == "" {
		return invalid("nama dan booth wajib diisi")
	}
	t.Initials = strings.ToUpper(strings.TrimSpace(t.Initials))
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
}

func (u *AdminUsecase) BulkCreateMembers(ctx context.Context, rows []MemberImportRow) (int, []domain.BulkRowError) {
	created := 0
	var errs []domain.BulkRowError
	for i, row := range rows {
		if _, err := u.CreateMember(ctx, row.Name, row.Email, "", row.Chapter, row.Company); err != nil {
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
}

func (u *AdminUsecase) BulkCreateTenants(ctx context.Context, rows []TenantImportRow) (int, []domain.BulkRowError) {
	created := 0
	var errs []domain.BulkRowError
	for i, row := range rows {
		if _, err := u.CreateTenant(ctx, row.Name, row.Category, row.Booth, row.Initials, row.Email, ""); err != nil {
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
		return invalid("ruang dan judul wajib diisi")
	}
	if s.Capacity <= 0 {
		return invalid("kapasitas harus lebih dari 0")
	}
	if s.Slot <= 0 {
		s.Slot = 1
	}
	return nil
}
