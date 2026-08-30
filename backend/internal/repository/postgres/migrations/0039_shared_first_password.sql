-- Everybody starts on the same first password.
--
-- Attendees used to start on their chapter plus their first name, and booths
-- on their company plus their stand. Both were derived so that no two
-- accounts shared a password — but both also had to be explained, person by
-- person, to eight hundred people arriving at once, and a rule nobody can
-- remember at the registration desk is a queue.
--
-- The committee's call: one password, SEED_PASSWORD, the same sentence for
-- everyone. What stops it from being a password shared for the whole day is
-- must_set_password — it opens the door exactly once, and the app refuses to
-- go any further until that person has chosen their own.
--
-- Only accounts still waiting for their first sign-in are touched. Anyone who
-- has already chosen a password keeps it: this puts the seeder's placeholder
-- back, and the seeder — which runs right after migrations on the same boot —
-- rewrites every placeholder with the hash of SEED_PASSWORD.

UPDATE users
SET password_hash = '$2a$10$SEEDPLACEHOLDERSEEDPLACEHOLDERSEEDPLACEHOLDERSEEDPLACEH'
WHERE must_set_password = true
  AND role IN ('member', 'tenant');
