package postgres

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

// SeedIfEmpty inserts demo data (members, booth/sponsor logins, tenants,
// seminars) when the users table is empty, and always ensures the admin
// account exists (so existing databases pick it up too). All accounts get
// the given password.
func SeedIfEmpty(ctx context.Context, pool *pgxpool.Pool, password string) error {
	if err := ensureAdmin(ctx, pool, password); err != nil {
		return err
	}

	var count int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE role <> 'admin'`).Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	members := []struct {
		name, email, code, chapter, company, phone string
	}{
		{"Reddie Wijaya", "reddie@natcon.id", "NATCON-2026-08154", "BNI Chapter Jakarta Elite", "Witid Intelligence", "+62811000154"},
		{"Sinta Dewi", "sinta@natcon.id", "NATCON-2026-08201", "BNI Chapter Jakarta Elite", "Sinta Florist", "+62811000201"},
		{"Agus Santoso", "agus@natcon.id", "NATCON-2026-08322", "BNI Chapter Bandung Raya", "Santoso Baja", "+62811000322"},
	}
	for _, m := range members {
		if _, err := tx.Exec(ctx, `
			INSERT INTO users (name, email, password_hash, role, member_code, chapter, company, phone)
			VALUES ($1, $2, $3, 'member', $4, $5, $6, $7)`,
			m.name, m.email, string(hash), m.code, m.chapter, m.company, m.phone); err != nil {
			return err
		}
	}

	tenants := []struct {
		name, category, booth, initials, kind, desc string
	}{
		{"BNI Xpora", "Main Sponsor", "SP-01", "BX", "sponsor", "BNI's one-stop export hub — banking solutions for members going global."},
		{"Wondr by BNI", "Digital Sponsor", "SP-02", "WB", "sponsor", "Personal finance super-app: payments, savings goals, and lifestyle deals."},
		{"Kopi Nusantara", "F&B", "A-03", "KN", "booth", "Single-origin Indonesian coffee, roasted in-house. Free cupping session at the booth."},
		{"Bank Mitra Sejahtera", "Finance", "A-05", "BM", "booth", "SME lending and cash-management partner for BNI chapter businesses."},
		{"Garuda Print Media", "Printing", "A-08", "GP", "booth", "Large-format printing and event branding with same-day turnaround."},
		{"TechNesia Solutions", "IT & Software", "B-01", "TS", "booth", "Custom software, ERP integrations, and managed cloud for growing teams."},
		{"Sehat Selalu Clinic", "Healthcare", "B-04", "SS", "booth", "Corporate health checks and on-site wellness programs."},
		{"Properti Prima", "Property", "B-07", "PP", "booth", "Commercial property advisory — office, warehouse, and retail spaces."},
		{"Logistik Cepat", "Logistics", "C-02", "LC", "booth", "Nationwide same-day and next-day delivery with live tracking."},
		{"Asuransi Aman", "Insurance", "C-05", "AA", "booth", "Business insurance tailored for SMEs: assets, liability, and health."},
		{"Kreasi Digital", "Marketing", "C-08", "KD", "booth", "Performance marketing and brand studios for ambitious businesses."},
		{"Hukum & Rekan", "Legal", "D-01", "HR", "booth", "Corporate legal counsel: contracts, compliance, and dispute resolution."},
		{"EduPro Training", "Training", "D-04", "EP", "booth", "Certified professional training for sales, leadership, and finance."},
		{"Katering Rasa", "F&B", "D-06", "KR", "booth", "Premium event catering with authentic archipelago menus."},
	}
	for _, t := range tenants {
		email := fmt.Sprintf("booth-%s@natcon.id", strings.ToLower(strings.ReplaceAll(t.booth, "-", "")))
		var ownerID int64
		if err := tx.QueryRow(ctx, `
			INSERT INTO users (name, email, password_hash, role, company)
			VALUES ($1, $2, $3, 'tenant', $1)
			RETURNING id`,
			t.name, email, string(hash)).Scan(&ownerID); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO tenants (name, category, booth, initials, kind, description, owner_user_id)
			VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			t.name, t.category, t.booth, t.initials, t.kind, t.desc, ownerID); err != nil {
			return err
		}
	}

	seminars := []struct {
		slot            int
		room, title, sp string
		capacity        int
		desc            string
	}{
		{1, "R. Merapi", "Scaling Referral: From Chapter to Nationwide", "Ir. Bambang Wicaksono — National Director", 60,
			"How top chapters turn one-to-one referrals into a national pipeline: a playbook of contact-sphere mapping, power teams, and measurable ask culture. Includes live case studies from three chapters that tripled closed business in a year."},
		{1, "R. Rinjani", "AI for SMEs: Practical, Not Hype", "Dr. Sarah Kusuma — Witid Intelligence", 40,
			"A no-jargon tour of AI tools an SME can deploy this quarter: lead scoring, follow-up automation, and customer insight dashboards — with real budgets and real ROI numbers from Indonesian businesses."},
	}
	for _, s := range seminars {
		if _, err := tx.Exec(ctx, `
			INSERT INTO seminars (slot, room, title, speaker, capacity, description, cover_url)
			VALUES ($1, $2, $3, $4, $5, $6, '')`,
			s.slot, s.room, s.title, s.sp, s.capacity, s.desc); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func ensureAdmin(ctx context.Context, pool *pgxpool.Pool, password string) error {
	var exists bool
	if err := pool.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM users WHERE role = 'admin')`).Scan(&exists); err != nil {
		return err
	}
	if exists {
		return nil
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	_, err = pool.Exec(ctx, `
		INSERT INTO users (name, email, password_hash, role, company)
		VALUES ('Natcon Committee', 'admin@natcon.id', $1, 'admin', 'BNI Indonesia')`,
		string(hash))
	return err
}
