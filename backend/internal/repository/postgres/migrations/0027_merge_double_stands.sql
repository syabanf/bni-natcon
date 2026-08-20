-- One brand on two stands is one exhibitor.
--
-- The booth sheet writes a double-width stand as "A18 & A20", and the
-- migration that read it used to make two booths out of that row. On the
-- floor that looked right — two signs — but in the app it made GrasiaCare two
-- exhibitors: two cards in the passport, two stamps for one company, two
-- towards the draw's booth minimum, and two scanner logins for one crew.
--
-- A database built after this change never splits them. This repairs one that
-- did: the second booth's scans move to the first (a member who was scanned
-- at both keeps one stamp, which is the point), then the spare booth and its
-- login go, and the survivor is relabelled with both stand numbers.

-- Scans first — the tenant rows they point at are about to disappear.
INSERT INTO visits (tenant_id, member_id, created_at)
SELECT keep.id, v.member_id, v.created_at
FROM visits v
JOIN tenants drop_t ON drop_t.id = v.tenant_id
JOIN (VALUES ('A18', 'A20'), ('A47', 'A48')) AS pair (keep, drop) ON drop_t.booth = pair.drop
JOIN tenants keep ON keep.booth = pair.keep
ON CONFLICT (tenant_id, member_id) DO NOTHING;

WITH removed AS (
    DELETE FROM tenants
    WHERE booth IN ('A20', 'A48')
    RETURNING owner_user_id
)
DELETE FROM users u USING removed r
WHERE u.id = r.owner_user_id AND u.role = 'tenant';

-- The sign, the passport and the floor plan should agree.
UPDATE tenants SET booth = 'A18 & A20' WHERE booth = 'A18';
UPDATE tenants SET booth = 'A47 & A48' WHERE booth = 'A47';

-- The logos were keyed on the booth code before they were keyed on the
-- company name; a database that took the earlier version keeps working.
UPDATE tenants SET logo_url = CASE logo_url
    WHEN '/logos/a4.png'  THEN '/logos/toffeedev.png'
    WHEN '/logos/a14.png' THEN '/logos/wit-id.png'
    WHEN '/logos/a17.png' THEN '/logos/one-tax.png'
    WHEN '/logos/a18.png' THEN '/logos/grasiacare.png'
    WHEN '/logos/a20.png' THEN '/logos/grasiacare.png'
    WHEN '/logos/a22.png' THEN '/logos/paper-id.png'
    WHEN '/logos/a25.png' THEN '/logos/lisanna.png'
    WHEN '/logos/a27.png' THEN '/logos/zona-kreatif.png'
    WHEN '/logos/a32.png' THEN '/logos/alps-wills.png'
    WHEN '/logos/b2.png'  THEN '/logos/parahita.png'
    WHEN '/logos/c1.png'  THEN '/logos/royal-medicalink.png'
    ELSE logo_url
END
WHERE logo_url IN ('/logos/a4.png', '/logos/a14.png', '/logos/a17.png',
                   '/logos/a18.png', '/logos/a20.png', '/logos/a22.png',
                   '/logos/a25.png', '/logos/a27.png', '/logos/a32.png',
                   '/logos/b2.png', '/logos/c1.png');
