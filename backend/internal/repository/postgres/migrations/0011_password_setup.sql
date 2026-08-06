-- Attendees sign in the first time with the password generated from their
-- chapter and first name, then choose their own. Everyone who exists today
-- got that generated password, so they all still have to pick one; accounts
-- created from here on start with the flag set too (see the import/CRUD code).
ALTER TABLE users ADD COLUMN must_set_password BOOLEAN NOT NULL DEFAULT false;

UPDATE users SET must_set_password = true WHERE role = 'member';

-- Recovery matches on chapter + phone, so both need to be searchable.
CREATE INDEX idx_users_chapter_phone ON users (lower(chapter), phone)
    WHERE role = 'member' AND phone <> '';
