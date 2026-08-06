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
		name, email, code, chapter, company, phone, classification string
	}{
		{"Reddie Wijaya", "reddie@natcon.id", "NATCON-2026-08154", "BNI Chapter Jakarta Elite", "Witid Intelligence", "+62811000154", "IT & Software"},
		{"Sinta Dewi", "sinta@natcon.id", "NATCON-2026-08201", "BNI Chapter Jakarta Elite", "Sinta Florist", "+62811000201", "Trade & Distribution"},
		{"Agus Santoso", "agus@natcon.id", "NATCON-2026-08322", "BNI Chapter Bandung Raya", "Santoso Baja", "+62811000322", "Manufacturing"},
	}
	for _, m := range members {
		if _, err := tx.Exec(ctx, `
			INSERT INTO users (name, email, password_hash, role, member_code, chapter, company, phone, classification)
			VALUES ($1, $2, $3, 'member', $4, $5, $6, $7, $8)`,
			m.name, m.email, string(hash), m.code, m.chapter, m.company, m.phone, m.classification); err != nil {
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

	// The four real breakout classes, from the Term of Reference documents.
	// All share slot 1: they run in parallel, so an attendee picks exactly one
	// and that pick is what the goodiebag is claimed against.
	seminars := []struct {
		slot                       int
		room, title, sp, moderator string
		capacity                   int
		desc                       string
	}{
		{1, "Breakout Room 1", "Navigating the Mid-Market HR Squeeze: Talent, AI, and Wellbeing in 2026",
			"Flavia N. Sungkit, M.Psi., Psikolog — HR Consultant, Ikigai", "Roby Oktober", 60,
			"Mid-sized companies have outgrown startup-style HR but lack enterprise budgets. A strategic roadmap for 2026: pivoting to skills-based management against high-potential turnover, setting boundaries for agentic AI in HR, treating burnout as a boardroom hazard through workflow redesign, and handling the compliance minefield without an internal legal team."},
		{1, "Breakout Room 2", "Work-Life Balance & AI: The New Agency Equation",
			"Viktor Iwan; Irfan Arsandi — WIT Indonesia", "Ryan Kristomulyono", 60,
			"AI is already in the stack — the question is how it changes the way we measure work. Moving from hours logged to outcome-based performance, the expansion of human agency as AI takes over execution, why 86% of advanced users treat AI output as a starting point, and using AI as a shield for work-life balance rather than a demand for 24/7 productivity."},
		{1, "Breakout Room 3", "How to Win in Retail: The 2026 Economic Reality",
			"Ben Wirawan — Torch; Selina Nicole — LEKA", "David Gan", 60,
			"Indonesian shoppers are fatigued by rising costs yet still crave premium experiences. Reading the economic trade-down and value hunting, why retail is a business of feelings when 58% of consumers report daily stress, the continued reign of the physical store, and preparing product data for the rise of agentic commerce."},
		{1, "Breakout Room 4", "Your Face Tells a Story",
			"Suntoro Suciatmaja", "", 60,
			"Reading faces as a practical business skill — what expression, structure, and first impressions communicate before a word is said, and how to use that in sales conversations, negotiation, and building trust fast."},
	}
	// Speakers and moderators per class, in stage order. Photos live in each
	// app's public/speakers/ so they are served by the static host, not the API.
	people := map[string][]struct {
		name, role, title, photo string
	}{
		"Breakout Room 1": {
			{"Flavia N. Sungkit, M.Psi., Psikolog", "speaker", "HR Consultant · Ikigai", "/speakers/flavia-sungkit.jpg"},
			{"Roby Oktober", "moderator", "", "/speakers/roby-oktober.jpg"},
		},
		"Breakout Room 2": {
			{"Viktor Iwan", "speaker", "", "/speakers/viktor-iwan.jpg"},
			{"Irfan Arsandi", "speaker", "IT & Digital Transformation Consultant · WIT Indonesia", "/speakers/irfan-arsandi.jpg"},
			{"Ryan Kristomulyono", "moderator", "", "/speakers/ryan-kristomulyono.jpg"},
		},
		"Breakout Room 3": {
			{"Ben Wirawan", "speaker", "Co-Founder & CEO · Torch", "/speakers/ben-wirawan.jpg"},
			{"Selina Nicole", "speaker", "Founder · LEKA", "/speakers/selina-nicole.jpg"},
			{"David Gan", "moderator", "CEO & Founder · Arkova Training & Consulting", "/speakers/david-gan.jpg"},
		},
		"Breakout Room 4": {
			{"Suntoro Suciatmaja", "speaker", "", "/speakers/suntoro-suciatmaja.jpg"},
		},
	}
	for _, s := range seminars {
		var semID int64
		if err := tx.QueryRow(ctx, `
			INSERT INTO seminars (slot, room, title, speaker, moderator, capacity, description, cover_url)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			RETURNING id`,
			s.slot, s.room, s.title, s.sp, s.moderator, s.capacity, s.desc,
			coverFor(s.room)).Scan(&semID); err != nil {
			return err
		}
		for i, p := range people[s.room] {
			if _, err := tx.Exec(ctx, `
				INSERT INTO seminar_speakers (seminar_id, name, role, title, photo_url, sort)
				VALUES ($1, $2, $3, $4, $5, $6)`,
				semID, p.name, p.role, p.title, p.photo, i); err != nil {
				return err
			}
		}
	}

	return tx.Commit(ctx)
}

// coverFor maps a breakout room to the poster shipped in each app's
// public/covers/. Rooms added later simply fall back to the gradient cover.
func coverFor(room string) string {
	switch room {
	case "Breakout Room 1":
		return "/covers/breakout-room-1.jpg"
	case "Breakout Room 2":
		return "/covers/breakout-room-2.jpg"
	case "Breakout Room 3":
		return "/covers/breakout-room-3.jpg"
	case "Breakout Room 4":
		return "/covers/breakout-room-4.jpg"
	}
	return ""
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
