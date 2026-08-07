package postgres

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"natcon2026/backend/internal/domain"
)

func isUniqueViolation(err error, constraint string) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505" &&
		(constraint == "" || pgErr.ConstraintName == constraint)
}

/* ----- Members ----- */

func (r *AdminRepo) ListMembers(ctx context.Context, q string, limit, offset int) ([]domain.MemberSummary, int, error) {
	const filter = `
		u.role = 'member' AND ($1 = '' OR
			u.name ILIKE '%' || $1 || '%' OR
			u.email ILIKE '%' || $1 || '%' OR
			u.member_code ILIKE '%' || $1 || '%' OR
			u.chapter ILIKE '%' || $1 || '%' OR
			u.phone ILIKE '%' || $1 || '%')`

	var total int
	if err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM users u WHERE `+filter, q).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := r.pool.Query(ctx, `
		SELECT u.id, u.name, u.email, u.role, COALESCE(u.member_code, ''), u.chapter, u.company, u.phone, u.classification, u.created_at,
		       (SELECT COUNT(*) FROM visits v WHERE v.member_id = u.id)
		FROM users u
		WHERE `+filter+`
		ORDER BY u.name
		LIMIT $2 OFFSET $3`, q, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var out []domain.MemberSummary
	for rows.Next() {
		var m domain.MemberSummary
		if err := rows.Scan(&m.ID, &m.Name, &m.Email, &m.Role, &m.MemberCode,
			&m.Chapter, &m.Company, &m.Phone, &m.Classification, &m.CreatedAt, &m.Visits); err != nil {
			return nil, 0, err
		}
		out = append(out, m)
	}
	return out, total, rows.Err()
}

func (r *AdminRepo) SeminarCheckin(ctx context.Context, seminarID int64, memberCode string) (*domain.CheckinResult, error) {
	var exists bool
	if err := r.pool.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM seminars WHERE id = $1)`, seminarID).Scan(&exists); err != nil {
		return nil, err
	}
	if !exists {
		return nil, domain.ErrNotFound
	}

	var res domain.CheckinResult
	var memberID int64
	err := r.pool.QueryRow(ctx, `
		SELECT id, name, COALESCE(member_code, ''), chapter
		FROM users WHERE member_code = $1 AND role = 'member'`, memberCode).
		Scan(&memberID, &res.MemberName, &res.MemberCode, &res.MemberChapter)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}

	var registered bool
	if err := r.pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM seminar_registrations
			WHERE seminar_id = $1 AND member_id = $2
		)`, seminarID, memberID).Scan(&registered); err != nil {
		return nil, err
	}
	if !registered {
		return nil, domain.ErrNotRegistered
	}

	tag, err := r.pool.Exec(ctx, `
		INSERT INTO seminar_attendance (seminar_id, member_id)
		VALUES ($1, $2) ON CONFLICT DO NOTHING`, seminarID, memberID)
	if err != nil {
		return nil, err
	}
	res.Duplicate = tag.RowsAffected() == 0

	if err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM seminar_attendance WHERE seminar_id = $1`, seminarID).
		Scan(&res.AttendedCount); err != nil {
		return nil, err
	}
	return &res, nil
}

func (r *AdminRepo) CreateMember(ctx context.Context, m domain.NewMember) (*domain.User, error) {
	// Attendees may share an address (two tickets, one buyer), but a tenant or
	// admin login is not something a member may collide with.
	var staffTaken bool
	if err := r.pool.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM users WHERE email = $1 AND role <> 'member')`,
		m.Email).Scan(&staffTaken); err != nil {
		return nil, err
	}
	if staffTaken {
		return nil, domain.ErrEmailTaken
	}

	var u domain.User
	err := r.pool.QueryRow(ctx, `
		INSERT INTO users (name, email, password_hash, role, member_code, chapter, company, phone, classification,
		                   must_set_password)
		VALUES ($1, $2, $3, 'member',
		        'NATCON-2026-' || lpad(nextval('member_code_seq')::text, 5, '0'),
		        $4, $5, $6, $7, true)
		RETURNING id, name, email, role, member_code, chapter, company, phone, classification,
		          must_set_password, ticket_number, created_at`,
		m.Name, m.Email, m.PasswordHash, m.Chapter, m.Company, m.Phone, m.Classification).
		Scan(&u.ID, &u.Name, &u.Email, &u.Role, &u.MemberCode, &u.Chapter, &u.Company, &u.Phone, &u.Classification, &u.MustSetPassword,
			&u.TicketNumber, &u.CreatedAt)
	if err != nil {
		if isUniqueViolation(err, "users_email_staff_key") {
			return nil, domain.ErrEmailTaken
		}
		return nil, err
	}
	return &u, nil
}

func (r *AdminRepo) UpdateMember(ctx context.Context, id int64, m domain.MemberUpdate) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE users SET name = $1, email = $2, chapter = $3, company = $4, phone = $5,
		       classification = $6
		WHERE id = $7 AND role = 'member'`,
		m.Name, m.Email, m.Chapter, m.Company, m.Phone, m.Classification, id)
	if err != nil {
		if isUniqueViolation(err, "users_email_staff_key") {
			return domain.ErrEmailTaken
		}
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *AdminRepo) DeleteMember(ctx context.Context, id int64) error {
	tag, err := r.pool.Exec(ctx,
		`DELETE FROM users WHERE id = $1 AND role = 'member'`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

/* ----- Tenants ----- */

func (r *AdminRepo) CreateTenant(ctx context.Context, t domain.NewTenant) (*domain.Tenant, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var ownerID int64
	err = tx.QueryRow(ctx, `
		INSERT INTO users (name, email, password_hash, role, company)
		VALUES ($1, $2, $3, 'tenant', $1)
		RETURNING id`,
		t.Name, t.Email, t.PasswordHash).Scan(&ownerID)
	if err != nil {
		if isUniqueViolation(err, "users_email_staff_key") {
			return nil, domain.ErrEmailTaken
		}
		return nil, err
	}

	var tenant domain.Tenant
	err = tx.QueryRow(ctx, `
		INSERT INTO tenants (name, category, booth, initials, kind, description,
		                     contact_name, chapter, owner_user_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, name, category, booth, initials, kind, description,
		          contact_name, chapter, owner_user_id`,
		t.Name, t.Category, t.Booth, t.Initials, t.Kind, t.Description,
		t.ContactName, t.Chapter, ownerID).
		Scan(&tenant.ID, &tenant.Name, &tenant.Category, &tenant.Booth, &tenant.Initials,
			&tenant.Kind, &tenant.Description, &tenant.ContactName, &tenant.Chapter, &tenant.OwnerUserID)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &tenant, nil
}

func (r *AdminRepo) UpdateTenant(ctx context.Context, id int64, t domain.TenantUpdate) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE tenants SET name = $1, category = $2, booth = $3, initials = $4,
		       kind = $5, description = $6, contact_name = $7, chapter = $8
		WHERE id = $9`,
		t.Name, t.Category, t.Booth, t.Initials, t.Kind, t.Description,
		t.ContactName, t.Chapter, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	// Keep the booth login's display name in sync.
	_, err = r.pool.Exec(ctx, `
		UPDATE users SET name = $1, company = $1
		WHERE id = (SELECT owner_user_id FROM tenants WHERE id = $2)`,
		t.Name, id)
	return err
}

func (r *AdminRepo) DeleteTenant(ctx context.Context, id int64) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var ownerID int64
	err = tx.QueryRow(ctx,
		`DELETE FROM tenants WHERE id = $1 RETURNING owner_user_id`, id).Scan(&ownerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ErrNotFound
		}
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM users WHERE id = $1`, ownerID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

/* ----- Seminars ----- */

func (r *AdminRepo) CreateSeminar(ctx context.Context, s domain.SeminarInput) (*domain.Seminar, error) {
	var sem domain.Seminar
	err := r.pool.QueryRow(ctx, `
		INSERT INTO seminars (slot, room, title, speaker, moderator, capacity, description, cover_url)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, slot, room, title, speaker, moderator, capacity, description, cover_url`,
		s.Slot, s.Room, s.Title, s.Speaker, s.Moderator, s.Capacity, s.Description, s.CoverURL).
		Scan(&sem.ID, &sem.Slot, &sem.Room, &sem.Title, &sem.Speaker, &sem.Moderator, &sem.Capacity, &sem.Description, &sem.CoverURL)
	if err != nil {
		return nil, err
	}
	if err := replaceSpeakers(ctx, r.pool, sem.ID, s.Speakers); err != nil {
		return nil, err
	}
	sem.Speakers = s.Speakers
	return &sem, nil
}

// replaceSpeakers swaps the whole speaker list for one class — the admin form
// posts the list as a unit, so there is nothing to diff.
func replaceSpeakers(ctx context.Context, q interface {
	Exec(context.Context, string, ...any) (pgconn.CommandTag, error)
}, seminarID int64, speakers []domain.SeminarSpeaker) error {
	if _, err := q.Exec(ctx, `DELETE FROM seminar_speakers WHERE seminar_id = $1`, seminarID); err != nil {
		return err
	}
	for i, sp := range speakers {
		role := sp.Role
		if role != domain.SpeakerRoleModerator {
			role = domain.SpeakerRoleSpeaker
		}
		if _, err := q.Exec(ctx, `
			INSERT INTO seminar_speakers (seminar_id, name, role, title, photo_url, sort)
			VALUES ($1, $2, $3, $4, $5, $6)`,
			seminarID, sp.Name, role, sp.Title, sp.PhotoURL, i); err != nil {
			return err
		}
	}
	return nil
}

func (r *AdminRepo) UpdateSeminar(ctx context.Context, id int64, s domain.SeminarInput) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE seminars SET slot = $1, room = $2, title = $3, speaker = $4, moderator = $5,
		       capacity = $6, description = $7, cover_url = $8
		WHERE id = $9`,
		s.Slot, s.Room, s.Title, s.Speaker, s.Moderator, s.Capacity, s.Description, s.CoverURL, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return replaceSpeakers(ctx, r.pool, id, s.Speakers)
}

func (r *AdminRepo) VisitReport(ctx context.Context) ([]domain.VisitReportRow, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT u.name, COALESCE(u.member_code, ''), u.chapter, u.company,
		       t.name, t.booth, v.created_at
		FROM visits v
		JOIN users u ON u.id = v.member_id
		JOIN tenants t ON t.id = v.tenant_id
		ORDER BY v.created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domain.VisitReportRow
	for rows.Next() {
		var v domain.VisitReportRow
		if err := rows.Scan(&v.MemberName, &v.MemberCode, &v.Chapter, &v.Company,
			&v.TenantName, &v.Booth, &v.VisitedAt); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

func (r *AdminRepo) RegistrationReport(ctx context.Context) ([]domain.RegistrationReportRow, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT u.name, COALESCE(u.member_code, ''), u.chapter,
		       s.slot, s.room, s.title, sr.created_at,
		       (sa.id IS NOT NULL)
		FROM seminar_registrations sr
		JOIN users u ON u.id = sr.member_id
		JOIN seminars s ON s.id = sr.seminar_id
		LEFT JOIN seminar_attendance sa
		       ON sa.seminar_id = sr.seminar_id AND sa.member_id = sr.member_id
		ORDER BY s.slot, s.room, sr.created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domain.RegistrationReportRow
	for rows.Next() {
		var v domain.RegistrationReportRow
		if err := rows.Scan(&v.MemberName, &v.MemberCode, &v.Chapter,
			&v.Slot, &v.Room, &v.SeminarTitle, &v.RegisteredAt, &v.Attended); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

func (r *AdminRepo) DeleteSeminar(ctx context.Context, id int64) error {
	tag, err := r.pool.Exec(ctx, `DELETE FROM seminars WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

/* ----- Member upsert (Excel import) ----- */

func (r *AdminRepo) UpsertMember(ctx context.Context, m domain.NewMember) (*domain.UpsertResult, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	// A ticket number identifies one attendee; an email may be shared by two
	// tickets bought together, so it is only the key when no ticket is given.
	var existingID int64
	var role string
	if m.TicketNumber != "" {
		err = tx.QueryRow(ctx,
			`SELECT id, role FROM users WHERE ticket_number = $1 FOR UPDATE`, m.TicketNumber).
			Scan(&existingID, &role)
	} else {
		err = tx.QueryRow(ctx,
			`SELECT id, role FROM users WHERE email = $1 AND role = 'member' FOR UPDATE`, m.Email).
			Scan(&existingID, &role)
	}
	switch {
	case err == nil && role != string(domain.RoleMember):
		return nil, domain.ErrEmailTaken
	case err == nil:
		var u domain.User
		err = tx.QueryRow(ctx, `
			UPDATE users SET name = $1, chapter = $2, company = $3, phone = $4,
			       classification = COALESCE(NULLIF($5, ''), classification),
			       email = $7
			WHERE id = $6
			RETURNING id, name, email, role, member_code, chapter, company, phone, classification,
		          must_set_password, ticket_number, created_at`,
			m.Name, m.Chapter, m.Company, m.Phone, m.Classification, existingID, m.Email).
			Scan(&u.ID, &u.Name, &u.Email, &u.Role, &u.MemberCode, &u.Chapter, &u.Company, &u.Phone,
				&u.Classification, &u.MustSetPassword, &u.TicketNumber, &u.CreatedAt)
		if err != nil {
			return nil, err
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, err
		}
		return &domain.UpsertResult{User: &u, Created: false}, nil
	case errors.Is(err, pgx.ErrNoRows):
		var u domain.User
		err = tx.QueryRow(ctx, `
			INSERT INTO users (name, email, password_hash, role, member_code, chapter, company, phone, classification,
			                   must_set_password, ticket_number)
			VALUES ($1, $2, $3, 'member',
			        'NATCON-2026-' || lpad(nextval('member_code_seq')::text, 5, '0'),
			        $4, $5, $6, $7, true, $8)
			RETURNING id, name, email, role, member_code, chapter, company, phone, classification,
		          must_set_password, ticket_number, created_at`,
			m.Name, m.Email, m.PasswordHash, m.Chapter, m.Company, m.Phone, m.Classification, m.TicketNumber).
			Scan(&u.ID, &u.Name, &u.Email, &u.Role, &u.MemberCode, &u.Chapter, &u.Company, &u.Phone,
				&u.Classification, &u.MustSetPassword, &u.TicketNumber, &u.CreatedAt)
		if err != nil {
			if isUniqueViolation(err, "users_email_staff_key") {
				return nil, domain.ErrEmailTaken
			}
			return nil, err
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, err
		}
		return &domain.UpsertResult{User: &u, Created: true}, nil
	default:
		return nil, err
	}
}

/* ----- Chapters ----- */

func (r *AdminRepo) ListChapters(ctx context.Context) ([]domain.Chapter, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT c.id, c.name,
		       (SELECT COUNT(*) FROM users u WHERE u.role = 'member' AND u.chapter = c.name)
		FROM chapters c
		ORDER BY c.name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domain.Chapter
	for rows.Next() {
		var c domain.Chapter
		if err := rows.Scan(&c.ID, &c.Name, &c.Members); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (r *AdminRepo) EnsureChapter(ctx context.Context, name string) error {
	if name == "" {
		return nil
	}
	_, err := r.pool.Exec(ctx,
		`INSERT INTO chapters (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, name)
	return err
}

func (r *AdminRepo) CreateChapter(ctx context.Context, name string) (*domain.Chapter, error) {
	var c domain.Chapter
	err := r.pool.QueryRow(ctx,
		`INSERT INTO chapters (name) VALUES ($1) RETURNING id, name`, name).
		Scan(&c.ID, &c.Name)
	if err != nil {
		if isUniqueViolation(err, "chapters_name_key") {
			return nil, domain.ErrNameTaken
		}
		return nil, err
	}
	return &c, nil
}

func (r *AdminRepo) RenameChapter(ctx context.Context, id int64, name string) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var oldName string
	err = tx.QueryRow(ctx,
		`SELECT name FROM chapters WHERE id = $1 FOR UPDATE`, id).Scan(&oldName)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ErrNotFound
		}
		return err
	}
	if _, err := tx.Exec(ctx,
		`UPDATE chapters SET name = $1 WHERE id = $2`, name, id); err != nil {
		if isUniqueViolation(err, "chapters_name_key") {
			return domain.ErrNameTaken
		}
		return err
	}
	// Members follow the chapter rename.
	if _, err := tx.Exec(ctx,
		`UPDATE users SET chapter = $1 WHERE role = 'member' AND chapter = $2`,
		name, oldName); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *AdminRepo) DeleteChapter(ctx context.Context, id int64) error {
	var name string
	err := r.pool.QueryRow(ctx, `SELECT name FROM chapters WHERE id = $1`, id).Scan(&name)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ErrNotFound
		}
		return err
	}
	var members int
	if err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM users WHERE role = 'member' AND chapter = $1`, name).
		Scan(&members); err != nil {
		return err
	}
	if members > 0 {
		return domain.ErrChapterInUse
	}
	_, err = r.pool.Exec(ctx, `DELETE FROM chapters WHERE id = $1`, id)
	return err
}

// UpsertTenant keys on the booth code: an existing booth is refreshed in
// place (scanner account and its scans survive), a new one is created
// along with its login user.
func (r *AdminRepo) UpsertTenant(ctx context.Context, t domain.NewTenant) (*domain.TenantUpsertResult, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var existingID, ownerID int64
	err = tx.QueryRow(ctx,
		`SELECT id, owner_user_id FROM tenants WHERE booth = $1 FOR UPDATE`, t.Booth).
		Scan(&existingID, &ownerID)

	var tenant domain.Tenant
	created := false
	switch {
	case err == nil:
		err = tx.QueryRow(ctx, `
			UPDATE tenants SET name = $1, category = $2, initials = $3, kind = $4, description = $5,
			       contact_name = $6, chapter = $7
			WHERE id = $8
			RETURNING id, name, category, booth, initials, kind, description,
			          contact_name, chapter, owner_user_id`,
			t.Name, t.Category, t.Initials, t.Kind, t.Description,
			t.ContactName, t.Chapter, existingID).
			Scan(&tenant.ID, &tenant.Name, &tenant.Category, &tenant.Booth, &tenant.Initials,
				&tenant.Kind, &tenant.Description, &tenant.ContactName, &tenant.Chapter, &tenant.OwnerUserID)
		if err != nil {
			return nil, err
		}
		// Keep the scanner login's display name in sync with the booth.
		if _, err := tx.Exec(ctx,
			`UPDATE users SET name = $1, company = $1 WHERE id = $2`, t.Name, ownerID); err != nil {
			return nil, err
		}
	case errors.Is(err, pgx.ErrNoRows):
		created = true
		err = tx.QueryRow(ctx, `
			INSERT INTO users (name, email, password_hash, role, company)
			VALUES ($1, $2, $3, 'tenant', $1)
			RETURNING id`,
			t.Name, t.Email, t.PasswordHash).Scan(&ownerID)
		if err != nil {
			if isUniqueViolation(err, "users_email_staff_key") {
				return nil, domain.ErrEmailTaken
			}
			return nil, err
		}
		err = tx.QueryRow(ctx, `
			INSERT INTO tenants (name, category, booth, initials, kind, description,
			                     contact_name, chapter, owner_user_id)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			RETURNING id, name, category, booth, initials, kind, description,
			          contact_name, chapter, owner_user_id`,
			t.Name, t.Category, t.Booth, t.Initials, t.Kind, t.Description,
			t.ContactName, t.Chapter, ownerID).
			Scan(&tenant.ID, &tenant.Name, &tenant.Category, &tenant.Booth, &tenant.Initials,
				&tenant.Kind, &tenant.Description, &tenant.ContactName, &tenant.Chapter, &tenant.OwnerUserID)
		if err != nil {
			return nil, err
		}
	default:
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &domain.TenantUpsertResult{Tenant: &tenant, Created: created}, nil
}

/* ----- Class registrations made by the committee ----- */

// resolveMember finds an attendee by member code, email, or phone — whichever
// the committee happened to type or the import sheet happened to carry.
func (r *AdminRepo) resolveMember(ctx context.Context, lookup string) (int64, string, string, string, error) {
	lookup = strings.TrimSpace(lookup)
	if lookup == "" {
		return 0, "", "", "", domain.ErrInvalidInput
	}
	var id int64
	var name, code, chapter string
	err := r.pool.QueryRow(ctx, `
		SELECT id, name, COALESCE(member_code, ''), chapter
		FROM users
		WHERE role = 'member'
		  AND (member_code = $1 OR lower(email) = lower($1) OR (phone <> '' AND phone = $1))
		LIMIT 1`, lookup).Scan(&id, &name, &code, &chapter)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, "", "", "", domain.ErrNotFound
		}
		return 0, "", "", "", err
	}
	return id, name, code, chapter, nil
}

// RegisterSeminarMember books an attendee into a class on the committee's
// behalf. Capacity and the one-class-per-slot rule are enforced exactly as
// they are for self-service registration.
func (r *AdminRepo) RegisterSeminarMember(ctx context.Context, seminarID int64, lookup string) (*domain.RegistrationResult, error) {
	memberID, name, code, chapter, err := r.resolveMember(ctx, lookup)
	if err != nil {
		return nil, err
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var slot, capacity int
	err = tx.QueryRow(ctx,
		`SELECT slot, capacity FROM seminars WHERE id = $1 FOR UPDATE`, seminarID).
		Scan(&slot, &capacity)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}

	// Already in this very class: report it rather than failing the import.
	var alreadyHere bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM seminar_registrations
			WHERE seminar_id = $1 AND member_id = $2
		)`, seminarID, memberID).Scan(&alreadyHere); err != nil {
		return nil, err
	}
	if alreadyHere {
		if err := tx.Commit(ctx); err != nil {
			return nil, err
		}
		return &domain.RegistrationResult{
			MemberName: name, MemberCode: code, MemberChapter: chapter, Duplicate: true,
		}, nil
	}

	var otherInSlot bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM seminar_registrations sr
			JOIN seminars s ON s.id = sr.seminar_id
			WHERE sr.member_id = $1 AND s.slot = $2
		)`, memberID, slot).Scan(&otherInSlot); err != nil {
		return nil, err
	}
	if otherInSlot {
		return nil, domain.ErrAlreadyRegistered
	}

	var taken int
	if err := tx.QueryRow(ctx,
		`SELECT COUNT(*) FROM seminar_registrations WHERE seminar_id = $1`, seminarID).Scan(&taken); err != nil {
		return nil, err
	}
	if taken >= capacity {
		return nil, domain.ErrSeminarFull
	}

	if _, err := tx.Exec(ctx,
		`INSERT INTO seminar_registrations (seminar_id, member_id) VALUES ($1, $2)`,
		seminarID, memberID); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &domain.RegistrationResult{
		MemberName: name, MemberCode: code, MemberChapter: chapter,
	}, nil
}

// UnregisterSeminarMember drops a registration (and any attendance recorded
// against it) by member code.
func (r *AdminRepo) UnregisterSeminarMember(ctx context.Context, seminarID int64, memberCode string) error {
	memberCode = strings.TrimSpace(memberCode)
	if memberCode == "" {
		return domain.ErrInvalidInput
	}
	tag, err := r.pool.Exec(ctx, `
		DELETE FROM seminar_registrations
		WHERE seminar_id = $1
		  AND member_id = (SELECT id FROM users WHERE member_code = $2)`, seminarID, memberCode)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	_, err = r.pool.Exec(ctx, `
		DELETE FROM seminar_attendance
		WHERE seminar_id = $1
		  AND member_id = (SELECT id FROM users WHERE member_code = $2)`, seminarID, memberCode)
	return err
}

// SeminarIDByRoom resolves an import row's class by room name, falling back to
// the class title — both case-insensitive.
func (r *AdminRepo) SeminarIDByRoom(ctx context.Context, room string) (int64, error) {
	room = strings.TrimSpace(room)
	if room == "" {
		return 0, domain.ErrInvalidInput
	}
	var id int64
	err := r.pool.QueryRow(ctx, `
		SELECT id FROM seminars
		WHERE lower(room) = lower($1) OR lower(title) = lower($1)
		ORDER BY id LIMIT 1`, room).Scan(&id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, domain.ErrNotFound
		}
		return 0, err
	}
	return id, nil
}
