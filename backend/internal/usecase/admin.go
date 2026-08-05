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
	if err := u.admin.EnsureChapter(ctx, strings.TrimSpace(chapter)); err != nil {
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
	m.Chapter = strings.TrimSpace(m.Chapter)
	if err := u.admin.EnsureChapter(ctx, m.Chapter); err != nil {
		return err
	}
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
	initials = tenantInitials(initials, name)
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

// tenantInitials keeps the given initials, or derives them from the first
// letters of the name (max 2 characters) when blank.
func tenantInitials(initials, name string) string {
	initials = strings.TrimSpace(initials)
	if initials == "" {
		for _, w := range strings.Fields(name) {
			initials += string([]rune(w)[0])
		}
		if len(initials) > 2 {
			initials = initials[:2]
		}
	}
	return strings.ToUpper(initials)
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

// importPassword derives the initial account password for an imported
// attendee: chapter + first name, lowercased with everything but letters
// and digits stripped — e.g. chapter "Heritage" + "Abraham Sebastian"
// becomes "heritageabraham". Easy for the committee to communicate:
// "your password is your chapter name plus your first name".
func importPassword(chapter, name string) string {
	slug := func(v string) string {
		var b strings.Builder
		for _, r := range strings.ToLower(v) {
			if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
				b.WriteRune(r)
			}
		}
		return b.String()
	}
	first := ""
	if fields := strings.Fields(name); len(fields) > 0 {
		first = fields[0]
	}
	return slug(chapter) + slug(first)
}

// BulkUpsertMembers imports rows create-or-update keyed by email: new
// emails become member accounts — username is the email, password is
// generated from chapter+first name (importPassword; default password
// when both are empty) — while existing member emails get their
// name/chapter/company/phone refreshed with the stored password kept.
// Every distinct chapter is registered in the chapters master data.
func (u *AdminUsecase) BulkUpsertMembers(ctx context.Context, rows []MemberImportRow) (created, updated int, errs []domain.BulkRowError) {
	for i, row := range rows {
		name := strings.TrimSpace(row.Name)
		email := strings.ToLower(strings.TrimSpace(row.Email))
		if name == "" || email == "" {
			errs = append(errs, domain.BulkRowError{Row: i + 1, Label: row.Email, Err: "name and email are required"})
			continue
		}
		if !validEmail(email) {
			errs = append(errs, domain.BulkRowError{Row: i + 1, Label: row.Email, Err: "invalid email format"})
			continue
		}
		password := importPassword(row.Chapter, name)
		if password == "" {
			password = u.defaultPassword
		}
		hash, err := u.hasher.Hash(password)
		if err != nil {
			errs = append(errs, domain.BulkRowError{Row: i + 1, Label: email, Err: err.Error()})
			continue
		}
		chapter := strings.TrimSpace(row.Chapter)
		if err := u.admin.EnsureChapter(ctx, chapter); err != nil {
			errs = append(errs, domain.BulkRowError{Row: i + 1, Label: email, Err: err.Error()})
			continue
		}
		res, err := u.admin.UpsertMember(ctx, domain.NewMember{
			Name: name, Email: email, PasswordHash: hash,
			Chapter: chapter, Company: strings.TrimSpace(row.Company),
			Phone: strings.TrimSpace(row.Phone),
		})
		if err != nil {
			errs = append(errs, domain.BulkRowError{Row: i + 1, Label: email, Err: err.Error()})
			continue
		}
		if res.Created {
			created++
		} else {
			updated++
		}
	}
	return created, updated, errs
}

/* ----- Networking tables ----- */

const maxGeneratedTables = 500

func (u *AdminUsecase) ListTables(ctx context.Context) ([]domain.NetworkingTable, error) {
	return u.admin.ListTables(ctx)
}

// GenerateTables appends a block of tables to the hall; numbering continues
// after the highest existing table so it is safe to run more than once.
func (u *AdminUsecase) GenerateTables(ctx context.Context, count int, hall string, capacity int) ([]domain.NetworkingTable, error) {
	if count <= 0 || count > maxGeneratedTables {
		return nil, invalid("number of tables must be between 1 and 500")
	}
	if capacity <= 0 {
		return nil, invalid("capacity must be greater than 0")
	}
	hall = strings.TrimSpace(hall)
	if hall == "" {
		hall = "Hall B"
	}
	return u.admin.GenerateTables(ctx, count, hall, capacity)
}

func (u *AdminUsecase) UpdateTable(ctx context.Context, id int64, hall string, capacity int) error {
	if capacity <= 0 {
		return invalid("capacity must be greater than 0")
	}
	hall = strings.TrimSpace(hall)
	if hall == "" {
		hall = "Hall B"
	}
	return u.admin.UpdateTable(ctx, id, hall, capacity)
}

func (u *AdminUsecase) DeleteTable(ctx context.Context, id int64) error {
	return u.admin.DeleteTable(ctx, id)
}

/* ----- Chapters ----- */

func (u *AdminUsecase) ListChapters(ctx context.Context) ([]domain.Chapter, error) {
	return u.admin.ListChapters(ctx)
}

func (u *AdminUsecase) CreateChapter(ctx context.Context, name string) (*domain.Chapter, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, invalid("chapter name is required")
	}
	return u.admin.CreateChapter(ctx, name)
}

func (u *AdminUsecase) RenameChapter(ctx context.Context, id int64, name string) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return invalid("chapter name is required")
	}
	return u.admin.RenameChapter(ctx, id, name)
}

func (u *AdminUsecase) DeleteChapter(ctx context.Context, id int64) error {
	return u.admin.DeleteChapter(ctx, id)
}

type TenantImportRow struct {
	Name        string
	Category    string
	Booth       string
	Initials    string
	Email       string
	Kind        string
	Description string
}

// BulkUpsertTenants imports rows create-or-update keyed by the booth code:
// a new booth becomes a tenant plus its scanner account (email defaults to
// booth-<code>@natcon.id, default password), while an existing booth gets
// name/category/initials/kind/description refreshed — its login and the
// scans it already collected are kept.
func (u *AdminUsecase) BulkUpsertTenants(ctx context.Context, rows []TenantImportRow) (created, updated int, errs []domain.BulkRowError) {
	hash := ""
	for i, row := range rows {
		name := strings.TrimSpace(row.Name)
		booth := strings.TrimSpace(row.Booth)
		if name == "" || booth == "" {
			errs = append(errs, domain.BulkRowError{Row: i + 1, Label: row.Name, Err: "name and booth are required"})
			continue
		}
		email := strings.ToLower(strings.TrimSpace(row.Email))
		if email == "" {
			email = fmt.Sprintf("booth-%s@natcon.id",
				strings.ToLower(strings.ReplaceAll(booth, "-", "")))
		} else if !validEmail(email) {
			errs = append(errs, domain.BulkRowError{Row: i + 1, Label: row.Name, Err: "invalid email format"})
			continue
		}
		// Every new booth account starts on the default password, so one
		// bcrypt hash covers the whole batch.
		if hash == "" {
			h, err := u.hasher.Hash(u.defaultPassword)
			if err != nil {
				errs = append(errs, domain.BulkRowError{Row: i + 1, Label: row.Name, Err: err.Error()})
				continue
			}
			hash = h
		}
		res, err := u.admin.UpsertTenant(ctx, domain.NewTenant{
			Name: name, Category: strings.TrimSpace(row.Category), Booth: booth,
			Initials: tenantInitials(row.Initials, name), Kind: normalizeTenantKind(row.Kind),
			Description: strings.TrimSpace(row.Description), Email: email, PasswordHash: hash,
		})
		if err != nil {
			errs = append(errs, domain.BulkRowError{Row: i + 1, Label: row.Name, Err: err.Error()})
			continue
		}
		if res.Created {
			created++
		} else {
			updated++
		}
	}
	return created, updated, errs
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
