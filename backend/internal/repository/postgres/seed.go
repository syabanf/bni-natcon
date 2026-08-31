package postgres

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

// SeedIfEmpty puts the committee's admin login into a fresh database, gives
// the booths from migration 0023 a password anyone can actually sign in with,
// and writes the event's programme — the four learning classes with their
// speakers and moderators, from the Term of Reference documents.
//
// Nothing is invented. Attendees and their chapters come from the ticketing
// export, the booths from the committee's booth sheet, the networking tables from
// the Tables page — so no demo account can ever turn up in front of a guest.
func SeedIfEmpty(ctx context.Context, pool *pgxpool.Pool, password string) error {
	if err := ensureAdmin(ctx, pool, password); err != nil {
		return err
	}
	// The door crew's own login. Without it the only way to work a class door
	// is to hand somebody the committee's account, which also opens the
	// attendee list, the master data and the draws.
	if err := ensureDoor(ctx, pool, password); err != nil {
		return err
	}
	// Committee logins with the same rights as admin, so nobody has to borrow
	// — or be told — the main admin password. Each is created only if the
	// address is absent, so a password its owner has since changed survives
	// every restart.
	for _, staff := range []struct{ email, name string }{
		{"panitia@natcon.id", "Panitia Natcon"},
		// Named committee member, on her own account rather than a shared one:
		// the activity log then says who did a thing, not that "panitia" did.
		{"f.lovitasari@gmail.com", "F. Lovitasari"},
	} {
		if err := ensureStaffAdmin(ctx, pool, staff.email, staff.name, password); err != nil {
			return err
		}
	}

	// The booth and attendee migrations write a placeholder hash nobody can
	// sign in with; this is where it becomes a real password. One statement
	// covers every account that has one, because everybody now starts on the
	// SAME password — SEED_PASSWORD, the one the committee prints on the
	// briefing sheet and reads out at registration.
	//
	// That is a deliberate trade the committee made: one sentence explains
	// sign-in to eight hundred people instead of a rule each of them has to
	// reconstruct from their own chapter and name. What keeps it from being
	// a shared password for the day is must_set_password — it opens the door
	// exactly once, and the app refuses to go further until that person has
	// chosen their own.
	//
	// Only untouched placeholders are rewritten, so an account whose password
	// has already been changed keeps it, and this runs once per account ever.
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	if _, err := pool.Exec(ctx, `
		UPDATE users SET password_hash = $1, must_set_password = true
		WHERE password_hash LIKE '$2a$10$SEEDPLACEHOLDER%'`, string(hash)); err != nil {
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

	// The four real learning classes, from the Term of Reference documents.
	// Two session GROUPS, two classes in each: the room label names the
	// group ("Learning Session 1" = 08.00, "Learning Session 2" = 10.00),
	// so both classes in an hour carry the same badge. An attendee picks
	// one class from each session.
	seminars := []struct {
		slot                       int
		room, title, sp, moderator string
		capacity                   int
		desc                       string
	}{
		{2, "Learning Session 2", "Navigating the Mid-Market HR Squeeze: Talent, AI, and Wellbeing in 2026",
			"Flavia N. Sungkit, M.Psi., Psikolog — HR Consultant, Ikigai", "Roby Oktober", 60,
			"Mid-sized companies have outgrown startup-style HR but lack enterprise budgets. A strategic roadmap for 2026: pivoting to skills-based management against high-potential turnover, setting boundaries for agentic AI in HR, treating burnout as a boardroom hazard through workflow redesign, and handling the compliance minefield without an internal legal team."},
		{1, "Learning Session 1", "Work-Life Balance & AI: The New Agency Equation",
			"Viktor Iwan; Irfan Arsandi — WIT Indonesia", "Ryan Kristomulyono", 60,
			"AI is already in the stack — the question is how it changes the way we measure work. Moving from hours logged to outcome-based performance, the expansion of human agency as AI takes over execution, why 86% of advanced users treat AI output as a starting point, and using AI as a shield for work-life balance rather than a demand for 24/7 productivity."},
		{2, "Learning Session 2", "How to Win in Retail: The 2026 Economic Reality",
			"Ben Wirawan — Torch; Selina Nicole — LEKA", "David Gan", 60,
			"Indonesian shoppers are fatigued by rising costs yet still crave premium experiences. Reading the economic trade-down and value hunting, why retail is a business of feelings when 58% of consumers report daily stress, the continued reign of the physical store, and preparing product data for the rise of agentic commerce."},
		{1, "Learning Session 1", "Your Face Tells a Story",
			"Suntoro Suciatmaja", "Ari H. Handojo", 60,
			"Reading faces as a practical business skill — what expression, structure, and first impressions communicate before a word is said, and how to use that in sales conversations, negotiation, and building trust fast."},
	}
	// Speakers and moderators per class, in stage order, keyed by the class
	// title — the room now names the session group two classes share. Photos
	// live in each app's public/speakers/ so they are served by the static
	// host, not the API.
	people := map[string][]struct {
		name, role, title, photo string
	}{
		"Navigating the Mid-Market HR Squeeze: Talent, AI, and Wellbeing in 2026": {
			{"Flavia N. Sungkit, M.Psi., Psikolog", "speaker", "HR Consultant · Ikigai", "/speakers/flavia-sungkit.jpg"},
			{"Roby Oktober", "moderator", "", "/speakers/roby-oktober.jpg"},
		},
		"Work-Life Balance & AI: The New Agency Equation": {
			{"Viktor Iwan", "speaker", "", "/speakers/viktor-iwan.jpg"},
			{"Irfan Arsandi", "speaker", "IT & Digital Transformation Consultant · WIT Indonesia", "/speakers/irfan-arsandi.jpg"},
			{"Ryan Kristomulyono", "moderator", "", "/speakers/ryan-kristomulyono.jpg"},
		},
		"How to Win in Retail: The 2026 Economic Reality": {
			{"Ben Wirawan", "speaker", "Co-Founder & CEO · Torch", "/speakers/ben-wirawan.jpg"},
			{"Selina Nicole", "speaker", "Founder · LEKA", "/speakers/selina-nicole.jpg"},
			{"David Gan", "moderator", "CEO & Founder · Arkova Training & Consulting", "/speakers/david-gan.jpg"},
		},
		"Your Face Tells a Story": {
			{"Suntoro Suciatmaja", "speaker", "", "/speakers/suntoro-suciatmaja.jpg"},
			{"Ari H. Handojo", "moderator", "", "/speakers/ari-h-handojo.jpg"},
		},
	}
	for _, s := range seminars {
		var semID int64
		if err := tx.QueryRow(ctx, `
			INSERT INTO seminars (slot, room, title, speaker, moderator, capacity, description, cover_url)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			RETURNING id`,
			s.slot, s.room, s.title, s.sp, s.moderator, s.capacity, s.desc,
			coverFor(s.title)).Scan(&semID); err != nil {
			return err
		}
		for i, p := range people[s.title] {
			if _, err := tx.Exec(ctx, `
				INSERT INTO seminar_speakers (seminar_id, name, role, title, photo_url, sort)
				VALUES ($1, $2, $3, $4, $5, $6)`,
				semID, p.name, p.role, p.title, p.photo, i); err != nil {
				return err
			}
		}
	}

	// Place each class in its learning block, the same way migration 0041 does
	// for a database that already holds them. The clash rule reads the
	// block's hours, so a class with no block is one an attendee can take
	// alongside anything.
	if _, err := tx.Exec(ctx, `
		UPDATE seminars s
		SET rundown_id = b.id
		FROM rundown b
		WHERE b.kind = 'learning'
		  AND b.title = 'Learning Session ' || s.slot::text
		  AND s.rundown_id IS NULL`); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// coverFor maps a class to the banner shipped in each app's public/covers/
// — the committee's own artwork, with the speakers on it. Keyed by title:
// the room names the session group two classes share. Classes added later
// simply fall back to the gradient cover. The files keep their original
// names: they are artwork on disk, not a label anybody reads.
func coverFor(title string) string {
	switch title {
	case "Navigating the Mid-Market HR Squeeze: Talent, AI, and Wellbeing in 2026":
		return "/covers/learning-class-1.jpg"
	case "Work-Life Balance & AI: The New Agency Equation":
		return "/covers/learning-class-2.jpg"
	case "How to Win in Retail: The 2026 Economic Reality":
		return "/covers/learning-class-3.jpg"
	case "Your Face Tells a Story":
		return "/covers/learning-class-4.jpg"
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

// ensureStaffAdmin creates an extra committee account with full admin
// rights. Created only if the address is absent, so a password the crew has
// since changed is never overwritten.
func ensureStaffAdmin(ctx context.Context, pool *pgxpool.Pool, email, name, password string) error {
	var exists bool
	if err := pool.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM users WHERE email = $1)`, email).Scan(&exists); err != nil {
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
		VALUES ($1, $2, $3, 'admin', 'BNI Indonesia')`,
		name, email, string(hash))
	return err
}

// ensureDoor creates door@natcon.id, the account the door app signs in with.
// It can take attendance, hand over goodiebags and hand over pins — and
// nothing else.
func ensureDoor(ctx context.Context, pool *pgxpool.Pool, password string) error {
	var exists bool
	if err := pool.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM users WHERE role = 'door')`).Scan(&exists); err != nil {
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
		VALUES ('Door Crew', 'door@natcon.id', $1, 'door', 'BNI Indonesia')`,
		string(hash))
	return err
}
