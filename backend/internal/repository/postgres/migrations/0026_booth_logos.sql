-- Company logos for the exhibitors who sent one.
--
-- The committee's logo pack numbers its booths A1–E13, while the booth sheet
-- this database was built from numbers them A1–A48 — two different floor
-- plans. So these are matched on the COMPANY NAME, checked by eye, and keyed
-- on the name here too: the booth code is the one thing the two lists do not
-- agree on, and an exhibitor holding two stands has a label ("A18 & A20")
-- rather than a code.
--
-- The files ship with the app (frontend/public/logos) rather than the upload
-- volume, so they survive a redeploy and need no /data mount. A logo the
-- committee uploads later through the admin panel wins: only an empty
-- logo_url is filled in here.
--
-- 10 of 36 exhibitors are covered. The rest sent nothing that matches a
-- company on the sheet, and their passport tile keeps the two-letter initials
-- it has now.

UPDATE tenants t
SET logo_url = v.logo
FROM (VALUES
    ('ToffeeDev',                                              '/logos/toffeedev.png'),
    ('WIT.id',                                                 '/logos/wit-id.png'),
    ('One Tax CM Pte Ltd',                                     '/logos/one-tax.png'),
    ('GrasiaCare',                                             '/logos/grasiacare.png'),
    ('Paper.id',                                               '/logos/paper-id.png'),
    ('Lisanna Online Accounting & Tax Consultant',             '/logos/lisanna.png'),
    ('PT Zona Kreatif Indonesia',                              '/logos/zona-kreatif.png'),
    ('Alps Wills Pte Ltd',                                     '/logos/alps-wills.png'),
    ('Parahita Diagnostic Center',                             '/logos/parahita.png'),
    ('T Royal Medicalink Pharmalab & PT Aroma Bathi Indonesia', '/logos/royal-medicalink.png')
) AS v (name, logo)
WHERE t.name = v.name AND t.logo_url = '';
