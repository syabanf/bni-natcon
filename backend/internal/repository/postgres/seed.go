package postgres

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

// SeedIfEmpty inserts demo data (members, booth logins, tenants, seminars)
// when the users table is empty, and always ensures the admin account exists
// (so existing databases pick it up too). All accounts get the given password.
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
		name, email, code, chapter, company string
	}{
		{"Reddie Wijaya", "reddie@natcon.id", "NATCON-2026-08154", "BNI Chapter Jakarta Elite", "Witid Intelligence"},
		{"Sinta Dewi", "sinta@natcon.id", "NATCON-2026-08201", "BNI Chapter Jakarta Elite", "Sinta Florist"},
		{"Agus Santoso", "agus@natcon.id", "NATCON-2026-08322", "BNI Chapter Bandung Raya", "Santoso Baja"},
	}
	for _, m := range members {
		if _, err := tx.Exec(ctx, `
			INSERT INTO users (name, email, password_hash, role, member_code, chapter, company)
			VALUES ($1, $2, $3, 'member', $4, $5, $6)`,
			m.name, m.email, string(hash), m.code, m.chapter, m.company); err != nil {
			return err
		}
	}

	tenants := []struct {
		name, category, booth, initials string
	}{
		{"Kopi Nusantara", "F&B", "A-03", "KN"},
		{"Bank Mitra Sejahtera", "Finansial", "A-05", "BM"},
		{"Garuda Print Media", "Percetakan", "A-08", "GP"},
		{"TechNesia Solutions", "IT & Software", "B-01", "TS"},
		{"Sehat Selalu Clinic", "Kesehatan", "B-04", "SS"},
		{"Properti Prima", "Properti", "B-07", "PP"},
		{"Logistik Cepat", "Logistik", "C-02", "LC"},
		{"Asuransi Aman", "Asuransi", "C-05", "AA"},
		{"Kreasi Digital", "Marketing", "C-08", "KD"},
		{"Hukum & Rekan", "Legal", "D-01", "HR"},
		{"EduPro Training", "Pelatihan", "D-04", "EP"},
		{"Katering Rasa", "F&B", "D-06", "KR"},
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
			INSERT INTO tenants (name, category, booth, initials, owner_user_id)
			VALUES ($1, $2, $3, $4, $5)`,
			t.name, t.category, t.booth, t.initials, ownerID); err != nil {
			return err
		}
	}

	seminars := []struct {
		slot            int
		room, title, sp string
		capacity        int
	}{
		{1, "R. Merapi", "Scaling Referral: Dari Chapter ke Nasional", "Ir. Bambang Wicaksono — National Director", 60},
		{1, "R. Rinjani", "AI untuk UKM: Praktis, Bukan Hype", "Dr. Sarah Kusuma — Witid Intelligence", 40},
	}
	for _, s := range seminars {
		if _, err := tx.Exec(ctx, `
			INSERT INTO seminars (slot, room, title, speaker, capacity)
			VALUES ($1, $2, $3, $4, $5)`,
			s.slot, s.room, s.title, s.sp, s.capacity); err != nil {
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
		VALUES ('Panitia Natcon', 'admin@natcon.id', $1, 'admin', 'BNI Indonesia')`,
		string(hash))
	return err
}
