-- Business classification comes from the ticketing export and is shown next
-- to each person at a speed-networking table, alongside their WhatsApp number
-- (users.phone, added in 0007).
ALTER TABLE users ADD COLUMN classification TEXT NOT NULL DEFAULT '';

-- Breakout classes are run by one or more speakers plus a moderator; the
-- existing `speaker` column holds the speakers, comma-separated.
ALTER TABLE seminars ADD COLUMN moderator TEXT NOT NULL DEFAULT '';
