package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"natcon2026/backend/internal/domain"
)

func (r *AdminRepo) MemberDetail(ctx context.Context, id int64) (*domain.MemberDetail, error) {
	var d domain.MemberDetail
	err := r.pool.QueryRow(ctx, `
		SELECT id, name, email, role, COALESCE(member_code, ''), chapter, company, phone, classification, created_at
		FROM users WHERE id = $1 AND role = 'member'`, id).
		Scan(&d.ID, &d.Name, &d.Email, &d.Role, &d.MemberCode, &d.Chapter, &d.Company, &d.Phone, &d.Classification, &d.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}

	rows, err := r.pool.Query(ctx, `
		SELECT t.name, t.booth, v.created_at
		FROM visits v JOIN tenants t ON t.id = v.tenant_id
		WHERE v.member_id = $1
		ORDER BY v.created_at DESC`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var v domain.MemberVisitRow
		if err := rows.Scan(&v.TenantName, &v.Booth, &v.VisitedAt); err != nil {
			return nil, err
		}
		d.Visits = append(d.Visits, v)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	regRows, err := r.pool.Query(ctx, `
		SELECT s.slot, s.room, s.title, sr.created_at
		FROM seminar_registrations sr JOIN seminars s ON s.id = sr.seminar_id
		WHERE sr.member_id = $1
		ORDER BY s.slot`, id)
	if err != nil {
		return nil, err
	}
	defer regRows.Close()
	for regRows.Next() {
		var v domain.MemberRegRow
		if err := regRows.Scan(&v.Slot, &v.Room, &v.Title, &v.RegisteredAt); err != nil {
			return nil, err
		}
		d.Registrations = append(d.Registrations, v)
	}
	return &d, regRows.Err()
}

func (r *AdminRepo) TenantDetail(ctx context.Context, id int64) (*domain.TenantDetail, error) {
	var d domain.TenantDetail
	err := r.pool.QueryRow(ctx, `
		SELECT t.id, t.name, t.category, t.booth, t.initials, t.kind, t.description,
		       t.logo_url, t.contact_name, t.chapter, t.owner_user_id, u.email,
		       (SELECT COUNT(*) FROM visits v WHERE v.tenant_id = t.id),
		       (SELECT COUNT(*) FROM visits v WHERE v.tenant_id = t.id AND v.created_at::date = CURRENT_DATE)
		FROM tenants t JOIN users u ON u.id = t.owner_user_id
		WHERE t.id = $1`, id).
		Scan(&d.ID, &d.Name, &d.Category, &d.Booth, &d.Initials, &d.Kind, &d.Description,
			&d.LogoURL, &d.ContactName, &d.Chapter,
			&d.OwnerUserID, &d.OwnerEmail, &d.TotalScans, &d.ScansToday)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}

	rows, err := r.pool.Query(ctx, `
		SELECT u.name, u.chapter, u.company, v.created_at
		FROM visits v JOIN users u ON u.id = v.member_id
		WHERE v.tenant_id = $1
		ORDER BY v.created_at DESC`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var v domain.Visitor
		if err := rows.Scan(&v.Name, &v.Chapter, &v.Company, &v.VisitedAt); err != nil {
			return nil, err
		}
		d.Visitors = append(d.Visitors, v)
	}
	return &d, rows.Err()
}

func (r *AdminRepo) SeminarDetail(ctx context.Context, id int64) (*domain.SeminarDetail, error) {
	var d domain.SeminarDetail
	err := r.pool.QueryRow(ctx, `
		SELECT s.id, s.slot, s.room, s.title, s.speaker, s.moderator, s.capacity, s.description, s.cover_url,
		       (SELECT COUNT(*) FROM seminar_registrations sr WHERE sr.seminar_id = s.id),
		       (SELECT COUNT(*) FROM seminar_attendance sa WHERE sa.seminar_id = s.id)
		FROM seminars s WHERE s.id = $1`, id).
		Scan(&d.ID, &d.Slot, &d.Room, &d.Title, &d.Speaker, &d.Moderator, &d.Capacity, &d.Description, &d.CoverURL, &d.SeatsTaken, &d.AttendedCount)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}

	byID, err := loadSpeakers(ctx, r.pool, []int64{id})
	if err != nil {
		return nil, err
	}
	d.Speakers = byID[id]

	rows, err := r.pool.Query(ctx, `
		SELECT u.name, COALESCE(u.member_code, ''), u.chapter, u.company, sr.created_at,
		       sa.created_at
		FROM seminar_registrations sr
		JOIN users u ON u.id = sr.member_id
		LEFT JOIN seminar_attendance sa
		       ON sa.seminar_id = sr.seminar_id AND sa.member_id = sr.member_id
		WHERE sr.seminar_id = $1
		ORDER BY sr.created_at`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var a domain.SeminarAttendee
		if err := rows.Scan(&a.Name, &a.MemberCode, &a.Chapter, &a.Company,
			&a.RegisteredAt, &a.CheckedInAt); err != nil {
			return nil, err
		}
		a.CheckedIn = a.CheckedInAt != nil
		d.Attendees = append(d.Attendees, a)
	}
	return &d, rows.Err()
}
