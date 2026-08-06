-- One buyer can hold two tickets, so two attendees can share an email address.
-- The ticket number becomes the member's identity for imports; the email stays
-- unique for tenant and admin logins, where sharing makes no sense.
ALTER TABLE users ADD COLUMN ticket_number TEXT NOT NULL DEFAULT '';

ALTER TABLE users DROP CONSTRAINT users_email_key;

CREATE UNIQUE INDEX users_email_staff_key ON users (email) WHERE role <> 'member';
CREATE INDEX idx_users_email ON users (email);
CREATE UNIQUE INDEX users_ticket_number_key ON users (ticket_number) WHERE ticket_number <> '';
