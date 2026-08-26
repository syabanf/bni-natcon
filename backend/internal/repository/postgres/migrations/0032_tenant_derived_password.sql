-- Every booth gets its own first password: company name + booth code,
-- lowercase, letters and digits only — witida14 for WIT.id on A14. The same
-- shape attendees already use (chapter + first name), so one sentence on the
-- briefing sheet explains both, and reading someone else's line no longer
-- opens someone else's booth.
--
-- The hashing itself happens in Go, not SQL: this migration only puts the
-- seeder's placeholder back on every tenant account that is still waiting
-- for its first sign-in (must_set_password), and the seeder — which runs
-- right after migrations on the same boot — rewrites each placeholder with
-- that booth's derived password. An account whose crew already chose their
-- own password is not touched.

UPDATE users u
SET password_hash = '$2a$10$SEEDPLACEHOLDERSEEDPLACEHOLDERSEEDPLACEHOLDERSEEDPLACEH'
FROM tenants t
WHERE t.owner_user_id = u.id
  AND u.role = 'tenant'
  AND u.must_set_password = true;
