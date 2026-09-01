-- The organiser's stand gets its mark: the BNI logo, processed through the
-- same pipeline as the rest of the floor. For databases that already ran
-- 0065; a fresh database gets it straight from the regenerated 0037.

UPDATE tenants
SET logo_url = '/logos/bni-indonesia.png'
WHERE lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g')) = 'bniindonesia'
  AND logo_url = '';
