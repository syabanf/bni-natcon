-- MoM revision: sponsor tenants, member phones, visitor & contact notes,
-- seminar detail (description + cover).
ALTER TABLE users ADD COLUMN phone TEXT NOT NULL DEFAULT '';
ALTER TABLE tenants ADD COLUMN kind TEXT NOT NULL DEFAULT 'booth';
ALTER TABLE tenants ADD COLUMN description TEXT NOT NULL DEFAULT '';
ALTER TABLE visits ADD COLUMN note TEXT NOT NULL DEFAULT '';
ALTER TABLE networking_contacts ADD COLUMN note TEXT NOT NULL DEFAULT '';
ALTER TABLE seminars ADD COLUMN description TEXT NOT NULL DEFAULT '';
ALTER TABLE seminars ADD COLUMN cover_url TEXT NOT NULL DEFAULT '';

CREATE INDEX idx_users_phone ON users (phone) WHERE phone <> '';
