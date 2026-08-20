-- Company logos for the exhibitors who sent one.
--
-- The committee's logo pack numbers its booths A1–E13, while the booth sheet
-- this database was built from numbers them A1–A48 — two different floor
-- plans. So these are matched on the COMPANY NAME, checked by eye, not on the
-- booth code: A22 is Paper.id in the sheet and "E12 - Paper Id" in the pack.
--
-- The files ship with the app (frontend/public/logos) rather than the upload
-- volume, so they survive a redeploy and need no /data mount. A logo the
-- committee uploads later through the admin panel wins: only an empty
-- logo_url is filled in here.
--
-- 11 of 38 exhibitors are covered. The rest sent nothing that matches a
-- company on the sheet, and their passport tile keeps the two-letter initials
-- it has now.

UPDATE tenants t
SET logo_url = v.logo
FROM (VALUES
    ('A4',  '/logos/a4.png'),   -- ToffeeDev
    ('A14', '/logos/a14.png'),  -- WIT.id
    ('A17', '/logos/a17.png'),  -- One Tax CM Pte Ltd
    ('A18', '/logos/a18.png'),  -- GrasiaCare (stand 1 of 2)
    ('A20', '/logos/a20.png'),  -- GrasiaCare (stand 2 of 2)
    ('A22', '/logos/a22.png'),  -- Paper.id
    ('A25', '/logos/a25.png'),  -- Lisanna Online Accounting & Tax Consultant
    ('A27', '/logos/a27.png'),  -- PT Zona Kreatif Indonesia
    ('A32', '/logos/a32.png'),  -- Alps Wills Pte Ltd
    ('B2',  '/logos/b2.png'),   -- Parahita Diagnostic Center (sponsor)
    ('C1',  '/logos/c1.png')    -- T Royal Medicalink Pharmalab (sponsor)
) AS v (booth, logo)
WHERE t.booth = v.booth AND t.logo_url = '';
