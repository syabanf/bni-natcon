package postgres

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

// SeedIfEmpty puts the committee's admin login into a fresh database, gives
// the booths from migration 0014 a password anyone can actually sign in with,
// and writes the event's programme — the four breakout classes with their
// speakers and moderators, from the Term of Reference documents.
//
// Nothing is invented. Attendees and their chapters come from the ticketing
// export, the booths from the Data Booth sheet, the networking tables from
// the Tables page — so no demo account can ever turn up in front of a guest.
func SeedIfEmpty(ctx context.Context, pool *pgxpool.Pool, password string) error {
	if err := ensureAdmin(ctx, pool, password); err != nil {
		return err
	}

	// Migration 0014 writes the booths with a placeholder hash nobody can
	// sign in with. Only untouched placeholders are rewritten, so a booth
	// whose password was changed since keeps it.
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	if _, err := pool.Exec(ctx, `
		UPDATE users SET password_hash = $1
		WHERE role = 'tenant' AND password_hash LIKE '$2a$10$SEEDPLACEHOLDER%'`,
		string(hash)); err != nil {
		return err
	}

	// The programme is written once. A committee that has since edited a
	// class in the admin panel must not have it overwritten on restart.
	var seminarCount int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM seminars`).Scan(&seminarCount); err != nil {
		return err
	}
	if seminarCount > 0 {
		return nil
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

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
