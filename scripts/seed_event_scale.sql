-- Fills a freshly-migrated database with the shape of a full Natcon day, for
-- timing pages, reports and exports against something realistic:
--
--   createdb -O natcon natcon_perf
--   ADDR=:8084 DATABASE_URL=…/natcon_perf go run ./cmd/api   # migrates + seeds
--   psql "$DATABASE_URL" -f scripts/seed_event_scale.sql
--
-- Roughly: 700 attendees (the real export was 668), 32 extra booths on top of
-- the seeded ones, ~6.5k booth scans, one class each with a third checked in,
-- and every attendee seated at a networking table with contacts saved.

BEGIN;

INSERT INTO users (name, email, password_hash, role, member_code, chapter, company, phone,
                   classification, must_set_password, ticket_number)
SELECT 'Attendee ' || i,
       'perf' || i || '@natcon.id',
       -- Not a usable password: these accounts are never signed into.
       '$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTU',
       'member',
       'NATCON-2026-' || lpad((20000 + i)::text, 5, '0'),
       'Chapter ' || (i % 70),
       'Company ' || i,
       '+62811' || lpad(i::text, 6, '0'),
       'Classification ' || (i % 12),
       true,
       'TKT-' || i
FROM generate_series(1, 700) i;

INSERT INTO users (name, email, password_hash, role, company)
SELECT 'Booth ' || i, 'perfbooth' || i || '@natcon.id',
       '$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTU', 'tenant', 'Booth ' || i
FROM generate_series(1, 32) i;

INSERT INTO tenants (name, category, booth, initials, kind, description, contact_name, chapter, owner_user_id)
SELECT 'Perf Booth ' || i, 'Category ' || (i % 10), 'P' || i, 'PB', 'booth',
       'A booth for load testing', 'Contact ' || i, 'Chapter ' || (i % 70), u.id
FROM generate_series(1, 32) i
JOIN users u ON u.email = 'perfbooth' || i || '@natcon.id';

-- Each attendee visits a spread of booths, scattered across a nine-hour day.
INSERT INTO visits (tenant_id, member_id, note, created_at)
SELECT t.id, m.id,
       CASE WHEN random() < 0.1 THEN 'follow up' ELSE '' END,
       now() - (random() * interval '9 hours')
FROM (SELECT id, row_number() OVER () rn FROM users WHERE role = 'member') m
JOIN (SELECT id, row_number() OVER () rn FROM tenants) t
  ON (m.rn + t.rn) % 5 = 0;

INSERT INTO seminar_registrations (seminar_id, member_id)
SELECT (SELECT id FROM seminars ORDER BY id LIMIT 1 OFFSET (m.rn % 4)), m.id
FROM (SELECT id, row_number() OVER () rn FROM users WHERE role = 'member') m;

INSERT INTO seminar_attendance (seminar_id, member_id)
SELECT sr.seminar_id, sr.member_id FROM seminar_registrations sr WHERE sr.id % 3 = 0;

INSERT INTO networking_tables (table_no, hall, capacity)
SELECT i, 'Hall B', 8 FROM generate_series(13, 90) i;

INSERT INTO networking_checkins (table_id, member_id, seat_no)
SELECT t.id, m.id, ((m.rn - 1) % 8) + 1
FROM (SELECT id, row_number() OVER () rn FROM users WHERE role = 'member') m
JOIN (SELECT id, row_number() OVER () rn FROM networking_tables) t
  ON t.rn = ((m.rn - 1) / 8) + 1;

INSERT INTO networking_table_history (member_id, table_no, hall)
SELECT c.member_id, t.table_no, t.hall
FROM networking_checkins c JOIN networking_tables t ON t.id = c.table_id;

INSERT INTO networking_contacts (owner_id, contact_id, note)
SELECT a.member_id, b.member_id, 'met at the table'
FROM networking_checkins a
JOIN networking_checkins b ON a.table_id = b.table_id AND a.member_id <> b.member_id;

COMMIT;
