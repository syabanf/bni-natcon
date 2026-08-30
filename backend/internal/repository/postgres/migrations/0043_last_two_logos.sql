-- Bio Medika and ProSnap sent their artwork.
--
-- These two were the only exhibitors on the floor still falling back to
-- initials, from the first logo pack right through to the last. The booth
-- migration reads scripts/booth-logos.json, so a fresh database already picks
-- them up; this is for the databases that do not get rebuilt.
--
-- Matched on the company name, not the stand, for the same reason everything
-- else here is: the floor plan has been redrawn twice.

UPDATE tenants
SET logo_url = '/logos/bio-medika.png'
WHERE lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g')) = 'biomedika'
  AND logo_url = '';

UPDATE tenants
SET logo_url = '/logos/prosnap.png'
WHERE lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g')) = 'prosnap'
  AND logo_url = '';
