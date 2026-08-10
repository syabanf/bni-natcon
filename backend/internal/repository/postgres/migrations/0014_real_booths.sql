-- The 31 real booths from the committee's "Data Booth" sheet, so every
-- database — a laptop, staging, production — ends up with the same master
-- data instead of someone remembering to import a spreadsheet.
--
-- Idempotent: a booth already present under its code is left alone, keeping
-- its scanner login and the scans it has collected.
--
-- The scanner accounts land on the default password (booth-<code>@natcon.id /
-- SEED_PASSWORD). Change SEED_PASSWORD before the event, or reset the booth
-- logins from the admin panel.

-- Scanner logins first: one tenant user per booth.
INSERT INTO users (name, email, password_hash, role, company)
SELECT v.company, v.email,
       -- Placeholder hash; the API's seeder rewrites booth logins to the
       -- configured SEED_PASSWORD on the next start.
       '$2a$10$SEEDPLACEHOLDERSEEDPLACEHOLDERSEEDPLACEHOLDERSEEDPLACEH',
       'tenant', v.company
FROM (VALUES
    ('A1', 'SSCX International', 'Management Consultant', 'SI', 'Nicolaas Andrew', 'Star', 'booth-a1@natcon.id'),
    ('A2', 'PT. ORIENTAL LOGISTICS INDONESIA', 'Freight Forwarder', 'PO', 'Joshua Sentosa', 'Champion', 'booth-a2@natcon.id'),
    ('A3', 'PT. Venamon', 'Manufacturer', 'PV', 'Henny Setiadi', 'Mahardika', 'booth-a3@natcon.id'),
    ('A4', 'ToffeeDev', 'SEO & Digital Marketing', 'T', 'Lidwina Damayanti', 'Dignify', 'booth-a4@natcon.id'),
    ('A5', 'Doxadigital', 'Digital Advertising', 'D', 'Viktor Iwan', 'Grow', 'booth-a5@natcon.id'),
    ('A6', 'PT Natural Spirit', 'Healthy Organic Foods', 'PN', 'Shirley Boedihartono', 'Vision', 'booth-a6@natcon.id'),
    ('A9', 'PT. Gunanusa Eramandiri Tbk', 'Manufacturer specializing in premium nut products and high-quality fruit solutions', 'PG', 'Ivan Cokro Saputra', 'Dynasty', 'booth-a9@natcon.id'),
    ('A10', 'PT Tanamera Mitra Sentosa', 'Coffee Wholesale', 'PT', 'Ronald Liong', 'Magnify', 'booth-a10@natcon.id'),
    ('A15', 'PT ForBis Asia Indonesia', 'HRIS Software & Payroll Services', 'PF', 'Afif Harness', 'Ignite', 'booth-a15@natcon.id'),
    ('A16', 'CV WIRABUANA SAKTI', 'automotive and stainless paint', 'CW', 'Anisa Andayani', 'Magnitude', 'booth-a16@natcon.id'),
    ('A17', 'One Tax CM Pte Ltd', 'Company Secretary', 'OT', 'Lancaster Lee', 'Champions (Singapore)', 'booth-a17@natcon.id'),
    ('A18', 'GrasiaCare', 'Profesional Service Health Care', 'G', 'Grace Debby', 'Grow', 'booth-a18@natcon.id'),
    ('A19', 'Sinar Printing (PT Sinar Media Kreasi)', 'Printer', 'SP', 'Mulyadi', 'Balionaire', 'booth-a19@natcon.id'),
    ('A20', 'GrasiaCare', 'Profesional Service Health Care', 'G', 'Grace Debby', 'Grow', 'booth-a20@natcon.id'),
    ('A22', 'Paper.id', 'B2B Digital Invoicing & Payment', 'PI', 'Jessica Dewi', 'Magnify', 'booth-a22@natcon.id'),
    ('A23', 'inHARMONY Preventive Clinic', 'Health & Wellness', 'IP', 'Dr. Kristoforus Hendra Djaya, SpPD, MBA', 'Tenacity', 'booth-a23@natcon.id'),
    ('A24', 'PT Documenta Corpora Technology', 'Legal Service Plan', 'PD', 'Teguh Panji Reza', 'Rise', 'booth-a24@natcon.id'),
    ('A25', 'Lisanna Online Accounting & Tax Consultant', 'Accounting & Tax Consultant', 'LO', 'Erly Salie', 'Grow', 'booth-a25@natcon.id'),
    ('A27', 'PT Zona Kreatif Indonesia', 'IT Custom Software Development', 'PZ', 'MUHAMMAD RIZKY', 'STAR', 'booth-a27@natcon.id'),
    ('A30', 'ICUBE (Invoice ke PT)', 'eCommerce Web and App Solution', 'I(', 'Muliadi Jeo', 'Sovereign', 'booth-a30@natcon.id'),
    ('A31', 'PT. Norita Flexindo', 'Flexible Packaging', 'PN', 'Eka Febrian Sutanto', 'Magnitude', 'booth-a31@natcon.id'),
    ('A32', 'Alps Wills Pte Ltd', 'Will writing', 'AW', 'Eilton Ho', 'Champions (Singapore)', 'booth-a32@natcon.id'),
    ('A33', 'BOOKINGTOGO', 'Travel Agent', 'B', 'Karni', 'Amplify', 'booth-a33@natcon.id'),
    ('A34', 'PAKS (MM2H) SDN BHD', 'MM2H', 'P(', 'Jason Law', 'Cheras Explorer Online (Malaysia)', 'booth-a34@natcon.id'),
    ('A36', 'CV. TRIANA BINTANG', 'Manufactur dan Distributor GENSET', 'CT', 'Felicia Iwantoro', 'Heritage', 'booth-a36@natcon.id'),
    ('A37', 'LEKA (PT Tissor Indonesia)', 'Retail - Electronics', 'L(', 'Selina Nicole', 'Magnify', 'booth-a37@natcon.id'),
    ('A38', 'CV IT Pro Solutions', 'Sales Force Automation', 'CI', 'Aloysius Bambang Prayitno', 'Heritage', 'booth-a38@natcon.id'),
    ('A42', 'PT. TSN Ariestama Jaya', 'Office Supplies', 'PT', 'Jonathan Danny', 'Star', 'booth-a42@natcon.id'),
    ('A43', 'PT. Creative Media Indonesia', 'Electronics Retailer', 'PC', 'Pata Salim', 'Achiever', 'booth-a43@natcon.id'),
    ('A44', 'KETAPANG INDAH HOTEL', 'HOTEL', 'KI', 'VERONICA IMELDA PARTOWIDJOJO', 'Champion', 'booth-a44@natcon.id'),
    ('A46', 'PT Belanja Segar Indonesia', 'Food Supplier', 'PB', 'Meilina Witan', 'Altitude', 'booth-a46@natcon.id')
) AS v (booth, company, category, initials, contact, chapter, email)
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.email = v.email)
  AND NOT EXISTS (SELECT 1 FROM tenants t WHERE t.booth = v.booth);

INSERT INTO tenants (name, category, booth, initials, kind, description,
                     contact_name, chapter, owner_user_id)
SELECT v.company, v.category, v.booth, v.initials, 'booth', '',
       v.contact, v.chapter, u.id
FROM (VALUES
    ('A1', 'SSCX International', 'Management Consultant', 'SI', 'Nicolaas Andrew', 'Star', 'booth-a1@natcon.id'),
    ('A2', 'PT. ORIENTAL LOGISTICS INDONESIA', 'Freight Forwarder', 'PO', 'Joshua Sentosa', 'Champion', 'booth-a2@natcon.id'),
    ('A3', 'PT. Venamon', 'Manufacturer', 'PV', 'Henny Setiadi', 'Mahardika', 'booth-a3@natcon.id'),
    ('A4', 'ToffeeDev', 'SEO & Digital Marketing', 'T', 'Lidwina Damayanti', 'Dignify', 'booth-a4@natcon.id'),
    ('A5', 'Doxadigital', 'Digital Advertising', 'D', 'Viktor Iwan', 'Grow', 'booth-a5@natcon.id'),
    ('A6', 'PT Natural Spirit', 'Healthy Organic Foods', 'PN', 'Shirley Boedihartono', 'Vision', 'booth-a6@natcon.id'),
    ('A9', 'PT. Gunanusa Eramandiri Tbk', 'Manufacturer specializing in premium nut products and high-quality fruit solutions', 'PG', 'Ivan Cokro Saputra', 'Dynasty', 'booth-a9@natcon.id'),
    ('A10', 'PT Tanamera Mitra Sentosa', 'Coffee Wholesale', 'PT', 'Ronald Liong', 'Magnify', 'booth-a10@natcon.id'),
    ('A15', 'PT ForBis Asia Indonesia', 'HRIS Software & Payroll Services', 'PF', 'Afif Harness', 'Ignite', 'booth-a15@natcon.id'),
    ('A16', 'CV WIRABUANA SAKTI', 'automotive and stainless paint', 'CW', 'Anisa Andayani', 'Magnitude', 'booth-a16@natcon.id'),
    ('A17', 'One Tax CM Pte Ltd', 'Company Secretary', 'OT', 'Lancaster Lee', 'Champions (Singapore)', 'booth-a17@natcon.id'),
    ('A18', 'GrasiaCare', 'Profesional Service Health Care', 'G', 'Grace Debby', 'Grow', 'booth-a18@natcon.id'),
    ('A19', 'Sinar Printing (PT Sinar Media Kreasi)', 'Printer', 'SP', 'Mulyadi', 'Balionaire', 'booth-a19@natcon.id'),
    ('A20', 'GrasiaCare', 'Profesional Service Health Care', 'G', 'Grace Debby', 'Grow', 'booth-a20@natcon.id'),
    ('A22', 'Paper.id', 'B2B Digital Invoicing & Payment', 'PI', 'Jessica Dewi', 'Magnify', 'booth-a22@natcon.id'),
    ('A23', 'inHARMONY Preventive Clinic', 'Health & Wellness', 'IP', 'Dr. Kristoforus Hendra Djaya, SpPD, MBA', 'Tenacity', 'booth-a23@natcon.id'),
    ('A24', 'PT Documenta Corpora Technology', 'Legal Service Plan', 'PD', 'Teguh Panji Reza', 'Rise', 'booth-a24@natcon.id'),
    ('A25', 'Lisanna Online Accounting & Tax Consultant', 'Accounting & Tax Consultant', 'LO', 'Erly Salie', 'Grow', 'booth-a25@natcon.id'),
    ('A27', 'PT Zona Kreatif Indonesia', 'IT Custom Software Development', 'PZ', 'MUHAMMAD RIZKY', 'STAR', 'booth-a27@natcon.id'),
    ('A30', 'ICUBE (Invoice ke PT)', 'eCommerce Web and App Solution', 'I(', 'Muliadi Jeo', 'Sovereign', 'booth-a30@natcon.id'),
    ('A31', 'PT. Norita Flexindo', 'Flexible Packaging', 'PN', 'Eka Febrian Sutanto', 'Magnitude', 'booth-a31@natcon.id'),
    ('A32', 'Alps Wills Pte Ltd', 'Will writing', 'AW', 'Eilton Ho', 'Champions (Singapore)', 'booth-a32@natcon.id'),
    ('A33', 'BOOKINGTOGO', 'Travel Agent', 'B', 'Karni', 'Amplify', 'booth-a33@natcon.id'),
    ('A34', 'PAKS (MM2H) SDN BHD', 'MM2H', 'P(', 'Jason Law', 'Cheras Explorer Online (Malaysia)', 'booth-a34@natcon.id'),
    ('A36', 'CV. TRIANA BINTANG', 'Manufactur dan Distributor GENSET', 'CT', 'Felicia Iwantoro', 'Heritage', 'booth-a36@natcon.id'),
    ('A37', 'LEKA (PT Tissor Indonesia)', 'Retail - Electronics', 'L(', 'Selina Nicole', 'Magnify', 'booth-a37@natcon.id'),
    ('A38', 'CV IT Pro Solutions', 'Sales Force Automation', 'CI', 'Aloysius Bambang Prayitno', 'Heritage', 'booth-a38@natcon.id'),
    ('A42', 'PT. TSN Ariestama Jaya', 'Office Supplies', 'PT', 'Jonathan Danny', 'Star', 'booth-a42@natcon.id'),
    ('A43', 'PT. Creative Media Indonesia', 'Electronics Retailer', 'PC', 'Pata Salim', 'Achiever', 'booth-a43@natcon.id'),
    ('A44', 'KETAPANG INDAH HOTEL', 'HOTEL', 'KI', 'VERONICA IMELDA PARTOWIDJOJO', 'Champion', 'booth-a44@natcon.id'),
    ('A46', 'PT Belanja Segar Indonesia', 'Food Supplier', 'PB', 'Meilina Witan', 'Altitude', 'booth-a46@natcon.id')
) AS v (booth, company, category, initials, contact, chapter, email)
JOIN users u ON u.email = v.email
WHERE NOT EXISTS (SELECT 1 FROM tenants t WHERE t.booth = v.booth);

-- The placeholder booths from the original mockup. They only go if nobody
-- has scanned them, so a database in use is never quietly emptied. The tenant
-- row goes first: its scanner login is referenced by a foreign key.
WITH removed AS (
    DELETE FROM tenants
    WHERE booth IN ('A-03','A-05','A-08','B-01','B-04','B-07',
                    'C-02','C-05','C-08','D-01','D-04','D-06')
      AND NOT EXISTS (SELECT 1 FROM visits v WHERE v.tenant_id = tenants.id)
    RETURNING owner_user_id
)
DELETE FROM users u
USING removed r
WHERE u.id = r.owner_user_id AND u.role = 'tenant';
