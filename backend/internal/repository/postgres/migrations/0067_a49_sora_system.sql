-- Stand A49 has its company now: PT. Sora System Global, Sound System
-- Manufacturer, with its logo — details the committee sent outside the
-- sheet (1 Sep 2026). The sheet's row named only the owner, who stays as
-- the stand's contact. For databases that seeded A49 under the owner's
-- name; a fresh database gets this from the regenerated 0037.

UPDATE users u
SET name = 'PT. Sora System Global', company = 'PT. Sora System Global'
FROM tenants t
WHERE t.owner_user_id = u.id AND t.booth = 'A49';

UPDATE tenants
SET name = 'PT. Sora System Global',
    category = 'Sound System Manufacturer',
    initials = 'PS',
    contact_name = 'Pak Andy Mulya Sutikno',
    logo_url = '/logos/sora-system-global.png'
WHERE booth = 'A49';

-- A crew that has not signed in yet goes back to the placeholder, so its
-- first password follows the company it is named for now.
UPDATE users u
SET password_hash = '$2a$10$SEEDPLACEHOLDERSEEDPLACEHOLDERSEEDPLACEHOLDERSEEDPLACEH'
FROM tenants t
WHERE t.owner_user_id = u.id AND t.booth = 'A49'
  AND u.role = 'tenant' AND u.must_set_password = true;
