-- The committee's 31 August revision of the participant & booth sheet,
-- for databases that already ran 0037/0038 from the 28 August one — those
-- two are keyed by filename and will not run again there. Fresh databases
-- get all of this from the regenerated 0037/0038 and skip straight through
-- here: every statement below is idempotent.
--
-- What changed on the sheet: 31 attendees corrected (mostly chapters — the
-- committee wrote "old -> new" into the cells, with "kosong" for removed),
-- one ticket withdrawn, and stand A49 added. GENERATED alongside
-- scripts/attendees_migration.py's regeneration — edit the sheet, not this.

-- The chapters the corrections move people into, registered first. The
-- lower(name) unique index from 0055 is the conflict target, so a case
-- twin cannot slip back in.
INSERT INTO chapters (name)
SELECT v.name FROM (VALUES
    ('Amplify'),
    ('Champion'),
    ('Dignify'),
    ('Grow'),
    ('Magnify'),
    ('Passion'),
    ('Prestige'),
    ('Star'),
    ('Titans'),
    ('Ventura')
) AS v (name)
WHERE NOT EXISTS (SELECT 1 FROM chapters c WHERE lower(c.name) = lower(v.name));

-- Titin Agustina: classification 'B2b Bag Manufacture' -> ''
UPDATE users SET classification = ''
WHERE ticket_number = '16798-22C8BA924' AND role = 'member';

-- Violison Martheo: classification 'Office System Furniture' -> ''
UPDATE users SET classification = ''
WHERE ticket_number = '16798-23DA61312' AND role = 'member';

-- Marcel Timotius Surjadi: chapter 'Magnify' -> 'Prestige'
UPDATE users SET chapter = 'Prestige'
WHERE ticket_number = '16798-2556D7043' AND role = 'member';

-- Badru Kamal ST: chapter 'Multirich' -> 'Ventura'
UPDATE users SET chapter = 'Ventura'
WHERE ticket_number = '16798-257801B60' AND role = 'member';

-- Yusfa Perdana: email 'ryuwono@kbs.co.id' -> 'yusfa@perdanalaw.com'
UPDATE users SET email = 'yusfa@perdanalaw.com'
WHERE ticket_number = '1679F-241143996' AND role = 'member';

-- violetanada jioe: chapter 'Prestige' -> 'Magnify'
UPDATE users SET chapter = 'Magnify'
WHERE ticket_number = '1679F-2526ACE73' AND role = 'member';

-- JUN SHEN HO: chapter 'Star' -> ''
UPDATE users SET chapter = ''
WHERE ticket_number = '167A5-244279393' AND role = 'member';

-- CHIA CHU WU: chapter 'Pioneer' -> ''
UPDATE users SET chapter = ''
WHERE ticket_number = '167A5-246CAAF72' AND role = 'member';

-- Hsuehhui Liu: chapter 'Grow' -> ''
UPDATE users SET chapter = ''
WHERE ticket_number = '167A5-247178718' AND role = 'member';

-- TSUNG-HAN CHENG: chapter 'Dynasty' -> ''
UPDATE users SET chapter = ''
WHERE ticket_number = '167A5-247997F91' AND role = 'member';

-- Dr Venugopal Rao Veeramaneni: chapter 'Ganesha' -> ''
UPDATE users SET chapter = ''
WHERE ticket_number = '167AB-24D27EC48' AND role = 'member';

-- Zaldy Wirjawan: chapter 'Multirich' -> 'Amplify'
UPDATE users SET chapter = 'Amplify'
WHERE ticket_number = '16C6C-23AD18319' AND role = 'member';

-- Bayu Bagja Ferdian: chapter 'Multirich' -> 'Ventura'
UPDATE users SET chapter = 'Ventura'
WHERE ticket_number = '16C6C-23D412283' AND role = 'member';

-- Sri Wahyuni: chapter 'x' -> 'Grow'
UPDATE users SET chapter = 'Grow'
WHERE ticket_number = '16C6C-23D7A6899' AND role = 'member';

-- Ghilmansyah Amri: chapter 'Multirich' -> 'Ventura'
UPDATE users SET chapter = 'Ventura'
WHERE ticket_number = '16C6C-24AE9B893' AND role = 'member';

-- Zaldy Wirjawan: chapter 'Multirich' -> 'Amplify'
UPDATE users SET chapter = 'Amplify'
WHERE ticket_number = '16C6C-24AEA0229' AND role = 'member';

-- Dani Ramdhani: chapter 'Multirich' -> 'Ventura'
UPDATE users SET chapter = 'Ventura'
WHERE ticket_number = '16C6C-252EE1F30' AND role = 'member';

-- Muhammad Rizky: chapter '' -> 'Star'
UPDATE users SET chapter = 'Star'
WHERE ticket_number = '171AF-23D496182' AND role = 'member';

-- Viktor Iwan: chapter 'Star' -> 'Grow'
UPDATE users SET chapter = 'Grow'
WHERE ticket_number = '171AF-256746A29' AND role = 'member';

-- Ferly F. Raya: chapter 'Magnify' -> ''
UPDATE users SET chapter = ''
WHERE ticket_number = '171AF-25675B471' AND role = 'member';

-- Ferly F. Raya: chapter 'Magnify' -> ''
UPDATE users SET chapter = ''
WHERE ticket_number = '171AF-25675B540' AND role = 'member';

-- Fenny Octavia: chapter '' -> 'Titans'
UPDATE users SET chapter = 'Titans'
WHERE ticket_number = '20780-25863A496' AND role = 'member';

-- Yosua Christian Setiawan: chapter '' -> 'Titans'
UPDATE users SET chapter = 'Titans'
WHERE ticket_number = '20780-25863C052' AND role = 'member';

-- Bingar Egidius Situmorang: chapter '' -> 'Champion', classification '' -> 'Health Spa & Wellness'
UPDATE users SET chapter = 'Champion', classification = 'Health Spa & Wellness'
WHERE ticket_number = '20780-25863D140' AND role = 'member';

-- Dewi Irma Kusvianty: chapter '' -> 'Passion', classification '' -> 'Social Media'
UPDATE users SET chapter = 'Passion', classification = 'Social Media'
WHERE ticket_number = '20780-25863E572' AND role = 'member';

-- Audrey Pradhita: chapter '' -> 'Passion', classification '' -> 'Cement/Concrete'
UPDATE users SET chapter = 'Passion', classification = 'Cement/Concrete'
WHERE ticket_number = '20780-25863F390' AND role = 'member';

-- Dayang Melati: chapter '' -> 'Dignify', classification '' -> 'Advertising Agency'
UPDATE users SET chapter = 'Dignify', classification = 'Advertising Agency'
WHERE ticket_number = '20780-258647159' AND role = 'member';

-- Vera Vania: chapter '' -> 'Dignify'
UPDATE users SET chapter = 'Dignify'
WHERE ticket_number = '20780-25864B236' AND role = 'member';

-- Jovian Alvin: chapter '' -> 'Dignify'
UPDATE users SET chapter = 'Dignify'
WHERE ticket_number = '20780-25864C571' AND role = 'member';

-- Yola Istianty Marga L: chapter '' -> 'Dignify'
UPDATE users SET chapter = 'Dignify'
WHERE ticket_number = '20780-25864ED22' AND role = 'member';

-- Stefanus Nicholas Gosaria: chapter '' -> 'Dignify'
UPDATE users SET chapter = 'Dignify'
WHERE ticket_number = '20780-25864FF57' AND role = 'member';

-- The withdrawn ticket goes, with the same guards the attendee migration
-- uses: one scan, one class seat or one check-in and the row stays.
DELETE FROM users u
WHERE u.role = 'member'
  AND u.ticket_number = '16798-22C8C3456'
  AND NOT EXISTS (SELECT 1 FROM visits x WHERE x.member_id = u.id)
  AND NOT EXISTS (SELECT 1 FROM seminar_registrations x WHERE x.member_id = u.id)
  AND NOT EXISTS (SELECT 1 FROM seminar_attendance x WHERE x.member_id = u.id)
  AND NOT EXISTS (SELECT 1 FROM networking_checkins x WHERE x.member_id = u.id)
  AND NOT EXISTS (SELECT 1 FROM draw_winners x WHERE x.member_id = u.id);

-- The floor plan, replayed from the regenerated 0037: its SQL upserts by
-- company and moves stands rather than recreating them, so on a database
-- that ran the 28 August version this simply adds stand A49.
INSERT INTO users (name, email, password_hash, role, company)
SELECT v.company, v.email, '$2a$10$SEEDPLACEHOLDERSEEDPLACEHOLDERSEEDPLACEHOLDERSEEDPLACEH', 'tenant', v.company
FROM (VALUES
    ('sscxinternational', 'A1', 'SSCX International', 'Management Consultant', 'SI', 'booth', 'booth-a1@natcon.id', '/logos/sscx-international.png', 'Nicolaas Andrew', 'STAR'),
    ('ptorientallogisticsindonesia', 'A2', 'PT. ORIENTAL LOGISTICS INDONESIA', 'Freight Forwarder', 'PO', 'booth', 'booth-a2@natcon.id', '/logos/oriental-logistics-indonesia.png', 'Joshua Sentosa', 'Champion'),
    ('ptvenamon', 'A3', 'PT. Venamon', 'Manufacturer', 'PV', 'booth', 'booth-a3@natcon.id', '/logos/venamon.png', 'Henny Setiadi', 'Mahardika'),
    ('toffeedev', 'A4', 'ToffeeDev', 'SEO & Digital Marketing', 'T', 'booth', 'booth-a4@natcon.id', '/logos/toffeedev.png', 'Lidwina Damayanti', 'Dignify'),
    ('doxadigital', 'A5', 'Doxadigital', 'Digital Advertising', 'D', 'booth', 'booth-a5@natcon.id', '/logos/doxadigital.png', 'Viktor Iwan', 'Grow'),
    ('ptnaturalspirit', 'A6', 'PT Natural Spirit', 'Healthy Organic Foods', 'PN', 'booth', 'booth-a6@natcon.id', '/logos/natural-spirit.png', 'Shirley Boedihartono', 'Vision'),
    ('ptgunanusaeramandiritbk', 'A9', 'PT. Gunanusa Eramandiri Tbk', 'Manufacturer specializing in premium nut products and high-quality fruit solutions', 'PG', 'booth', 'booth-a9@natcon.id', '/logos/gunanusa-eramandiri.png', 'Ivan Cokro Saputra', 'Dynasty'),
    ('pttanameramitrasentosa', 'A10', 'PT Tanamera Mitra Sentosa', 'Coffee Wholesale', 'PT', 'booth', 'booth-a10@natcon.id', '/logos/tanamera-mitra-sentosa.png', 'Ronald Liong', 'Magnify'),
    ('ptforbisasiaindonesia', 'A15', 'PT ForBis Asia Indonesia', 'Employment Activities', 'PF', 'booth', 'booth-a15@natcon.id', '/logos/forbis-asia-indonesia.png', 'Afif Harness', 'Ignite'),
    ('witid', 'A14', 'WIT.ID', 'Computer & Programming', 'W', 'booth', 'booth-a14@natcon.id', '/logos/wit-id.png', 'Ilham Kurniawan', 'Grow'),
    ('cvwirabuanasakti', 'A16', 'CV WIRABUANA SAKTI', 'automotive and stainless paint', 'CW', 'booth', 'booth-a16@natcon.id', '/logos/wirabuana-sakti.png', 'Anisa Andayani', 'Magnitude'),
    ('onetaxcmpteltd', 'A17', 'One Tax CM Pte Ltd', 'Company Secretary', 'OT', 'booth', 'booth-a17@natcon.id', '/logos/one-tax-cm.png', 'Lancaster Lee', 'Champions (Singapore)'),
    ('grasiacare', 'A18 & A20', 'GrasiaCare', 'Profesional Service Health Care', 'G', 'booth', 'booth-a18@natcon.id', '/logos/grasiacare.png', 'Grace Debby', 'Grow'),
    ('sinarprintingptsinarmediakreasi', 'A19', 'Sinar Printing (PT Sinar Media Kreasi)', 'Advertising & Marketing', 'SP', 'booth', 'booth-a19@natcon.id', '/logos/sinar-printing-sinar.png', 'Mulyadi', 'Balionaire'),
    ('paperid', 'A22', 'Paper.id', 'B2B Digital Invoicing & Payment', 'P', 'booth', 'booth-a22@natcon.id', '/logos/paper-id.png', 'Jessica Dewi', 'Magnify'),
    ('inharmonypreventiveclinic', 'A23', 'inHARMONY Preventive Clinic', 'Health & Wellness', 'IP', 'booth', 'booth-a23@natcon.id', '/logos/inharmony-preventive-clinic.png', 'Dr. Kristoforus Hendra Djaya, SpPD, MBA', 'Tenacity'),
    ('ptdocumentacorporatechnology', 'A24', 'PT Documenta Corpora Technology', 'Legal & Accounting', 'PD', 'booth', 'booth-a24@natcon.id', '/logos/documenta-corpora-technology.png', 'Teguh Panji Reza', 'Rise'),
    ('lisannaonlineaccountingtaxconsultant', 'A25', 'Lisanna Online Accounting & Tax Consultant', 'Accounting & Tax Consultant', 'LO', 'booth', 'booth-a25@natcon.id', '/logos/lisanna-online-accounting.png', 'Erly Salie', 'Grow'),
    ('ptzonakreatifindonesia', 'A27', 'PT Zona Kreatif Indonesia', 'IT Custom Software Development', 'PZ', 'booth', 'booth-a27@natcon.id', '/logos/zona-kreatif-indonesia.png', 'MUHAMMAD RIZKY', 'STAR'),
    ('icubeinvoicekept', 'A30', 'ICUBE (Invoice ke PT)', 'eCommerce Web and App Solution', 'I(', 'booth', 'booth-a30@natcon.id', '/logos/icube.png', 'Muliadi Jeo', 'Sovereign'),
    ('ptnoritaflexindo', 'A31', 'PT. Norita Flexindo', 'Flexible Packaging', 'PN', 'booth', 'booth-a31@natcon.id', '/logos/norita-flexindo.png', 'Eka Febrian Sutanto', 'Magnitude'),
    ('alpswillspteltd', 'A32', 'Alps Wills Pte Ltd', 'Will writing', 'AW', 'booth', 'booth-a32@natcon.id', '/logos/alps-wills.png', 'Eilton Ho', 'Champions'),
    ('bookingtogo', 'A33', 'BOOKINGTOGO', 'Travel Agent', 'B', 'booth', 'booth-a33@natcon.id', '/logos/bookingtogo.png', 'Karni', 'Amplify'),
    ('paksmm2hsdnbhd', 'A34', 'PAKS (MM2H) SDN BHD', 'MM2H', 'P(', 'booth', 'booth-a34@natcon.id', '/logos/paks-mm2h.png', 'Jason Law', 'Cheras Explorer Online'),
    ('cvtrianabintang', 'A36', 'CV. TRIANA BINTANG', 'Manufactur dan Distributor GENSET', 'CT', 'booth', 'booth-a36@natcon.id', '/logos/triana-bintang.png', 'Felicia Iwantro', 'Heritage'),
    ('lekapttissorindonesia', 'A37', 'LEKA (PT Tissor Indonesia)', 'Retail - Electronics', 'L(', 'booth', 'booth-a37@natcon.id', '/logos/leka-tissor-indonesia.png', 'Selina', 'Magnify'),
    ('cvitprosolutions', 'A38', 'CV IT Pro Solutions', 'Sales Force Automation', 'CI', 'booth', 'booth-a38@natcon.id', '/logos/it-pro-solutions.png', 'Aloysius Bambang Prayitno', 'Heritage Semarang'),
    ('pttsnariestamajaya', 'A42', 'PT. TSN Ariestama Jaya', 'Retail', 'PT', 'booth', 'booth-a42@natcon.id', '/logos/tsn-ariestama-jaya.png', 'Jonathan Danny', 'Star'),
    ('ptcreativemediaindonesia', 'A43', 'PT. Creative Media Indonesia', 'Retail', 'PC', 'booth', 'booth-a43@natcon.id', '/logos/creative-media-indonesia.png', 'Pata Salim', 'Achiever'),
    ('ketapangindahhotel', 'A44', 'KETAPANG INDAH HOTEL', 'HOTEL', 'KI', 'booth', 'booth-a44@natcon.id', '/logos/ketapang-indah-hotel.png', 'VERONICA IMELDA PARTOWIDJOJO', 'CHAMPION'),
    ('ptbelanjasegarindonesia', 'A46', 'PT Belanja Segar Indonesia', 'Food Supplier', 'PB', 'booth', 'booth-a46@natcon.id', '/logos/belanja-segar-indonesia.png', 'Meilina Witan', 'Altitude'),
    ('alphaleaders', 'A47 & A48', 'ALPHA LEADERS', '', 'AL', 'booth', 'booth-a47@natcon.id', '/logos/alpha-leaders.png', 'Ferly F. Raya', ''),
    ('pakandymulyasutikno', 'A49', 'Pak Andy Mulya Sutikno', '', 'PA', 'booth', 'booth-a49@natcon.id', '', 'Pak Andy Mulya Sutikno', 'Lighthouse'),
    ('biomedika', 'B1', 'Bio Medika', 'Medical Services', 'BM', 'sponsor', 'booth-b1@natcon.id', '/logos/bio-medika.png', 'Agus Subroto', 'Champion'),
    ('parahitadiagnosticcenter', 'B2', 'Parahita Diagnostic Center', 'Health & Wellness Services', 'PD', 'sponsor', 'booth-b2@natcon.id', '/logos/parahita-diagnostic-center.png', 'Mizan Tamimy', 'Sovereign'),
    ('prosnap', 'B3', 'ProSnap', 'Business Consultant', 'P', 'sponsor', 'booth-b3@natcon.id', '/logos/prosnap.png', 'Leonard Rosandy', 'Star'),
    ('ptroyalmedicalinkpharmalabptaromabathiindonesia', 'C1', 'PT Royal Medicalink Pharmalab & PT Aroma Bathi Indonesia', 'Pharmaceutical Manufacturing', 'PR', 'sponsor', 'booth-c1@natcon.id', '/logos/royal-medicalink-pharmalab.png', 'Bu Dyah & Pak David Gani', '')
) AS v (key, booth, company, category, initials, kind, email, logo, contact, chapter)
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.email = v.email)
  AND NOT EXISTS (SELECT 1 FROM tenants t WHERE t.booth = v.booth);

INSERT INTO tenants (name, category, booth, initials, kind, description,
                     contact_name, chapter, logo_url, owner_user_id)
SELECT v.company, v.category, v.booth, v.initials, v.kind, '',
       v.contact, v.chapter, v.logo, u.id
FROM (VALUES
    ('sscxinternational', 'A1', 'SSCX International', 'Management Consultant', 'SI', 'booth', 'booth-a1@natcon.id', '/logos/sscx-international.png', 'Nicolaas Andrew', 'STAR'),
    ('ptorientallogisticsindonesia', 'A2', 'PT. ORIENTAL LOGISTICS INDONESIA', 'Freight Forwarder', 'PO', 'booth', 'booth-a2@natcon.id', '/logos/oriental-logistics-indonesia.png', 'Joshua Sentosa', 'Champion'),
    ('ptvenamon', 'A3', 'PT. Venamon', 'Manufacturer', 'PV', 'booth', 'booth-a3@natcon.id', '/logos/venamon.png', 'Henny Setiadi', 'Mahardika'),
    ('toffeedev', 'A4', 'ToffeeDev', 'SEO & Digital Marketing', 'T', 'booth', 'booth-a4@natcon.id', '/logos/toffeedev.png', 'Lidwina Damayanti', 'Dignify'),
    ('doxadigital', 'A5', 'Doxadigital', 'Digital Advertising', 'D', 'booth', 'booth-a5@natcon.id', '/logos/doxadigital.png', 'Viktor Iwan', 'Grow'),
    ('ptnaturalspirit', 'A6', 'PT Natural Spirit', 'Healthy Organic Foods', 'PN', 'booth', 'booth-a6@natcon.id', '/logos/natural-spirit.png', 'Shirley Boedihartono', 'Vision'),
    ('ptgunanusaeramandiritbk', 'A9', 'PT. Gunanusa Eramandiri Tbk', 'Manufacturer specializing in premium nut products and high-quality fruit solutions', 'PG', 'booth', 'booth-a9@natcon.id', '/logos/gunanusa-eramandiri.png', 'Ivan Cokro Saputra', 'Dynasty'),
    ('pttanameramitrasentosa', 'A10', 'PT Tanamera Mitra Sentosa', 'Coffee Wholesale', 'PT', 'booth', 'booth-a10@natcon.id', '/logos/tanamera-mitra-sentosa.png', 'Ronald Liong', 'Magnify'),
    ('ptforbisasiaindonesia', 'A15', 'PT ForBis Asia Indonesia', 'Employment Activities', 'PF', 'booth', 'booth-a15@natcon.id', '/logos/forbis-asia-indonesia.png', 'Afif Harness', 'Ignite'),
    ('witid', 'A14', 'WIT.ID', 'Computer & Programming', 'W', 'booth', 'booth-a14@natcon.id', '/logos/wit-id.png', 'Ilham Kurniawan', 'Grow'),
    ('cvwirabuanasakti', 'A16', 'CV WIRABUANA SAKTI', 'automotive and stainless paint', 'CW', 'booth', 'booth-a16@natcon.id', '/logos/wirabuana-sakti.png', 'Anisa Andayani', 'Magnitude'),
    ('onetaxcmpteltd', 'A17', 'One Tax CM Pte Ltd', 'Company Secretary', 'OT', 'booth', 'booth-a17@natcon.id', '/logos/one-tax-cm.png', 'Lancaster Lee', 'Champions (Singapore)'),
    ('grasiacare', 'A18 & A20', 'GrasiaCare', 'Profesional Service Health Care', 'G', 'booth', 'booth-a18@natcon.id', '/logos/grasiacare.png', 'Grace Debby', 'Grow'),
    ('sinarprintingptsinarmediakreasi', 'A19', 'Sinar Printing (PT Sinar Media Kreasi)', 'Advertising & Marketing', 'SP', 'booth', 'booth-a19@natcon.id', '/logos/sinar-printing-sinar.png', 'Mulyadi', 'Balionaire'),
    ('paperid', 'A22', 'Paper.id', 'B2B Digital Invoicing & Payment', 'P', 'booth', 'booth-a22@natcon.id', '/logos/paper-id.png', 'Jessica Dewi', 'Magnify'),
    ('inharmonypreventiveclinic', 'A23', 'inHARMONY Preventive Clinic', 'Health & Wellness', 'IP', 'booth', 'booth-a23@natcon.id', '/logos/inharmony-preventive-clinic.png', 'Dr. Kristoforus Hendra Djaya, SpPD, MBA', 'Tenacity'),
    ('ptdocumentacorporatechnology', 'A24', 'PT Documenta Corpora Technology', 'Legal & Accounting', 'PD', 'booth', 'booth-a24@natcon.id', '/logos/documenta-corpora-technology.png', 'Teguh Panji Reza', 'Rise'),
    ('lisannaonlineaccountingtaxconsultant', 'A25', 'Lisanna Online Accounting & Tax Consultant', 'Accounting & Tax Consultant', 'LO', 'booth', 'booth-a25@natcon.id', '/logos/lisanna-online-accounting.png', 'Erly Salie', 'Grow'),
    ('ptzonakreatifindonesia', 'A27', 'PT Zona Kreatif Indonesia', 'IT Custom Software Development', 'PZ', 'booth', 'booth-a27@natcon.id', '/logos/zona-kreatif-indonesia.png', 'MUHAMMAD RIZKY', 'STAR'),
    ('icubeinvoicekept', 'A30', 'ICUBE (Invoice ke PT)', 'eCommerce Web and App Solution', 'I(', 'booth', 'booth-a30@natcon.id', '/logos/icube.png', 'Muliadi Jeo', 'Sovereign'),
    ('ptnoritaflexindo', 'A31', 'PT. Norita Flexindo', 'Flexible Packaging', 'PN', 'booth', 'booth-a31@natcon.id', '/logos/norita-flexindo.png', 'Eka Febrian Sutanto', 'Magnitude'),
    ('alpswillspteltd', 'A32', 'Alps Wills Pte Ltd', 'Will writing', 'AW', 'booth', 'booth-a32@natcon.id', '/logos/alps-wills.png', 'Eilton Ho', 'Champions'),
    ('bookingtogo', 'A33', 'BOOKINGTOGO', 'Travel Agent', 'B', 'booth', 'booth-a33@natcon.id', '/logos/bookingtogo.png', 'Karni', 'Amplify'),
    ('paksmm2hsdnbhd', 'A34', 'PAKS (MM2H) SDN BHD', 'MM2H', 'P(', 'booth', 'booth-a34@natcon.id', '/logos/paks-mm2h.png', 'Jason Law', 'Cheras Explorer Online'),
    ('cvtrianabintang', 'A36', 'CV. TRIANA BINTANG', 'Manufactur dan Distributor GENSET', 'CT', 'booth', 'booth-a36@natcon.id', '/logos/triana-bintang.png', 'Felicia Iwantro', 'Heritage'),
    ('lekapttissorindonesia', 'A37', 'LEKA (PT Tissor Indonesia)', 'Retail - Electronics', 'L(', 'booth', 'booth-a37@natcon.id', '/logos/leka-tissor-indonesia.png', 'Selina', 'Magnify'),
    ('cvitprosolutions', 'A38', 'CV IT Pro Solutions', 'Sales Force Automation', 'CI', 'booth', 'booth-a38@natcon.id', '/logos/it-pro-solutions.png', 'Aloysius Bambang Prayitno', 'Heritage Semarang'),
    ('pttsnariestamajaya', 'A42', 'PT. TSN Ariestama Jaya', 'Retail', 'PT', 'booth', 'booth-a42@natcon.id', '/logos/tsn-ariestama-jaya.png', 'Jonathan Danny', 'Star'),
    ('ptcreativemediaindonesia', 'A43', 'PT. Creative Media Indonesia', 'Retail', 'PC', 'booth', 'booth-a43@natcon.id', '/logos/creative-media-indonesia.png', 'Pata Salim', 'Achiever'),
    ('ketapangindahhotel', 'A44', 'KETAPANG INDAH HOTEL', 'HOTEL', 'KI', 'booth', 'booth-a44@natcon.id', '/logos/ketapang-indah-hotel.png', 'VERONICA IMELDA PARTOWIDJOJO', 'CHAMPION'),
    ('ptbelanjasegarindonesia', 'A46', 'PT Belanja Segar Indonesia', 'Food Supplier', 'PB', 'booth', 'booth-a46@natcon.id', '/logos/belanja-segar-indonesia.png', 'Meilina Witan', 'Altitude'),
    ('alphaleaders', 'A47 & A48', 'ALPHA LEADERS', '', 'AL', 'booth', 'booth-a47@natcon.id', '/logos/alpha-leaders.png', 'Ferly F. Raya', ''),
    ('pakandymulyasutikno', 'A49', 'Pak Andy Mulya Sutikno', '', 'PA', 'booth', 'booth-a49@natcon.id', '', 'Pak Andy Mulya Sutikno', 'Lighthouse'),
    ('biomedika', 'B1', 'Bio Medika', 'Medical Services', 'BM', 'sponsor', 'booth-b1@natcon.id', '/logos/bio-medika.png', 'Agus Subroto', 'Champion'),
    ('parahitadiagnosticcenter', 'B2', 'Parahita Diagnostic Center', 'Health & Wellness Services', 'PD', 'sponsor', 'booth-b2@natcon.id', '/logos/parahita-diagnostic-center.png', 'Mizan Tamimy', 'Sovereign'),
    ('prosnap', 'B3', 'ProSnap', 'Business Consultant', 'P', 'sponsor', 'booth-b3@natcon.id', '/logos/prosnap.png', 'Leonard Rosandy', 'Star'),
    ('ptroyalmedicalinkpharmalabptaromabathiindonesia', 'C1', 'PT Royal Medicalink Pharmalab & PT Aroma Bathi Indonesia', 'Pharmaceutical Manufacturing', 'PR', 'sponsor', 'booth-c1@natcon.id', '/logos/royal-medicalink-pharmalab.png', 'Bu Dyah & Pak David Gani', '')
) AS v (key, booth, company, category, initials, kind, email, logo, contact, chapter)
JOIN users u ON u.email = v.email
WHERE NOT EXISTS (SELECT 1 FROM tenants t WHERE t.booth = v.booth);

-- ---------------------------------------------------------------- details
-- An exhibitor already on the floor plan follows the sheet: the committee
-- edits there, not here. The logo is the one exception — it comes from the
-- artwork pack, so an empty entry never wipes a logo already in place.
UPDATE tenants t
SET name = v.company, category = v.category, initials = v.initials,
    kind = v.kind, contact_name = v.contact, chapter = v.chapter,
    logo_url = CASE WHEN v.logo <> '' THEN v.logo ELSE t.logo_url END
FROM (VALUES
    ('sscxinternational', 'A1', 'SSCX International', 'Management Consultant', 'SI', 'booth', 'booth-a1@natcon.id', '/logos/sscx-international.png', 'Nicolaas Andrew', 'STAR'),
    ('ptorientallogisticsindonesia', 'A2', 'PT. ORIENTAL LOGISTICS INDONESIA', 'Freight Forwarder', 'PO', 'booth', 'booth-a2@natcon.id', '/logos/oriental-logistics-indonesia.png', 'Joshua Sentosa', 'Champion'),
    ('ptvenamon', 'A3', 'PT. Venamon', 'Manufacturer', 'PV', 'booth', 'booth-a3@natcon.id', '/logos/venamon.png', 'Henny Setiadi', 'Mahardika'),
    ('toffeedev', 'A4', 'ToffeeDev', 'SEO & Digital Marketing', 'T', 'booth', 'booth-a4@natcon.id', '/logos/toffeedev.png', 'Lidwina Damayanti', 'Dignify'),
    ('doxadigital', 'A5', 'Doxadigital', 'Digital Advertising', 'D', 'booth', 'booth-a5@natcon.id', '/logos/doxadigital.png', 'Viktor Iwan', 'Grow'),
    ('ptnaturalspirit', 'A6', 'PT Natural Spirit', 'Healthy Organic Foods', 'PN', 'booth', 'booth-a6@natcon.id', '/logos/natural-spirit.png', 'Shirley Boedihartono', 'Vision'),
    ('ptgunanusaeramandiritbk', 'A9', 'PT. Gunanusa Eramandiri Tbk', 'Manufacturer specializing in premium nut products and high-quality fruit solutions', 'PG', 'booth', 'booth-a9@natcon.id', '/logos/gunanusa-eramandiri.png', 'Ivan Cokro Saputra', 'Dynasty'),
    ('pttanameramitrasentosa', 'A10', 'PT Tanamera Mitra Sentosa', 'Coffee Wholesale', 'PT', 'booth', 'booth-a10@natcon.id', '/logos/tanamera-mitra-sentosa.png', 'Ronald Liong', 'Magnify'),
    ('ptforbisasiaindonesia', 'A15', 'PT ForBis Asia Indonesia', 'Employment Activities', 'PF', 'booth', 'booth-a15@natcon.id', '/logos/forbis-asia-indonesia.png', 'Afif Harness', 'Ignite'),
    ('witid', 'A14', 'WIT.ID', 'Computer & Programming', 'W', 'booth', 'booth-a14@natcon.id', '/logos/wit-id.png', 'Ilham Kurniawan', 'Grow'),
    ('cvwirabuanasakti', 'A16', 'CV WIRABUANA SAKTI', 'automotive and stainless paint', 'CW', 'booth', 'booth-a16@natcon.id', '/logos/wirabuana-sakti.png', 'Anisa Andayani', 'Magnitude'),
    ('onetaxcmpteltd', 'A17', 'One Tax CM Pte Ltd', 'Company Secretary', 'OT', 'booth', 'booth-a17@natcon.id', '/logos/one-tax-cm.png', 'Lancaster Lee', 'Champions (Singapore)'),
    ('grasiacare', 'A18 & A20', 'GrasiaCare', 'Profesional Service Health Care', 'G', 'booth', 'booth-a18@natcon.id', '/logos/grasiacare.png', 'Grace Debby', 'Grow'),
    ('sinarprintingptsinarmediakreasi', 'A19', 'Sinar Printing (PT Sinar Media Kreasi)', 'Advertising & Marketing', 'SP', 'booth', 'booth-a19@natcon.id', '/logos/sinar-printing-sinar.png', 'Mulyadi', 'Balionaire'),
    ('paperid', 'A22', 'Paper.id', 'B2B Digital Invoicing & Payment', 'P', 'booth', 'booth-a22@natcon.id', '/logos/paper-id.png', 'Jessica Dewi', 'Magnify'),
    ('inharmonypreventiveclinic', 'A23', 'inHARMONY Preventive Clinic', 'Health & Wellness', 'IP', 'booth', 'booth-a23@natcon.id', '/logos/inharmony-preventive-clinic.png', 'Dr. Kristoforus Hendra Djaya, SpPD, MBA', 'Tenacity'),
    ('ptdocumentacorporatechnology', 'A24', 'PT Documenta Corpora Technology', 'Legal & Accounting', 'PD', 'booth', 'booth-a24@natcon.id', '/logos/documenta-corpora-technology.png', 'Teguh Panji Reza', 'Rise'),
    ('lisannaonlineaccountingtaxconsultant', 'A25', 'Lisanna Online Accounting & Tax Consultant', 'Accounting & Tax Consultant', 'LO', 'booth', 'booth-a25@natcon.id', '/logos/lisanna-online-accounting.png', 'Erly Salie', 'Grow'),
    ('ptzonakreatifindonesia', 'A27', 'PT Zona Kreatif Indonesia', 'IT Custom Software Development', 'PZ', 'booth', 'booth-a27@natcon.id', '/logos/zona-kreatif-indonesia.png', 'MUHAMMAD RIZKY', 'STAR'),
    ('icubeinvoicekept', 'A30', 'ICUBE (Invoice ke PT)', 'eCommerce Web and App Solution', 'I(', 'booth', 'booth-a30@natcon.id', '/logos/icube.png', 'Muliadi Jeo', 'Sovereign'),
    ('ptnoritaflexindo', 'A31', 'PT. Norita Flexindo', 'Flexible Packaging', 'PN', 'booth', 'booth-a31@natcon.id', '/logos/norita-flexindo.png', 'Eka Febrian Sutanto', 'Magnitude'),
    ('alpswillspteltd', 'A32', 'Alps Wills Pte Ltd', 'Will writing', 'AW', 'booth', 'booth-a32@natcon.id', '/logos/alps-wills.png', 'Eilton Ho', 'Champions'),
    ('bookingtogo', 'A33', 'BOOKINGTOGO', 'Travel Agent', 'B', 'booth', 'booth-a33@natcon.id', '/logos/bookingtogo.png', 'Karni', 'Amplify'),
    ('paksmm2hsdnbhd', 'A34', 'PAKS (MM2H) SDN BHD', 'MM2H', 'P(', 'booth', 'booth-a34@natcon.id', '/logos/paks-mm2h.png', 'Jason Law', 'Cheras Explorer Online'),
    ('cvtrianabintang', 'A36', 'CV. TRIANA BINTANG', 'Manufactur dan Distributor GENSET', 'CT', 'booth', 'booth-a36@natcon.id', '/logos/triana-bintang.png', 'Felicia Iwantro', 'Heritage'),
    ('lekapttissorindonesia', 'A37', 'LEKA (PT Tissor Indonesia)', 'Retail - Electronics', 'L(', 'booth', 'booth-a37@natcon.id', '/logos/leka-tissor-indonesia.png', 'Selina', 'Magnify'),
    ('cvitprosolutions', 'A38', 'CV IT Pro Solutions', 'Sales Force Automation', 'CI', 'booth', 'booth-a38@natcon.id', '/logos/it-pro-solutions.png', 'Aloysius Bambang Prayitno', 'Heritage Semarang'),
    ('pttsnariestamajaya', 'A42', 'PT. TSN Ariestama Jaya', 'Retail', 'PT', 'booth', 'booth-a42@natcon.id', '/logos/tsn-ariestama-jaya.png', 'Jonathan Danny', 'Star'),
    ('ptcreativemediaindonesia', 'A43', 'PT. Creative Media Indonesia', 'Retail', 'PC', 'booth', 'booth-a43@natcon.id', '/logos/creative-media-indonesia.png', 'Pata Salim', 'Achiever'),
    ('ketapangindahhotel', 'A44', 'KETAPANG INDAH HOTEL', 'HOTEL', 'KI', 'booth', 'booth-a44@natcon.id', '/logos/ketapang-indah-hotel.png', 'VERONICA IMELDA PARTOWIDJOJO', 'CHAMPION'),
    ('ptbelanjasegarindonesia', 'A46', 'PT Belanja Segar Indonesia', 'Food Supplier', 'PB', 'booth', 'booth-a46@natcon.id', '/logos/belanja-segar-indonesia.png', 'Meilina Witan', 'Altitude'),
    ('alphaleaders', 'A47 & A48', 'ALPHA LEADERS', '', 'AL', 'booth', 'booth-a47@natcon.id', '/logos/alpha-leaders.png', 'Ferly F. Raya', ''),
    ('pakandymulyasutikno', 'A49', 'Pak Andy Mulya Sutikno', '', 'PA', 'booth', 'booth-a49@natcon.id', '', 'Pak Andy Mulya Sutikno', 'Lighthouse'),
    ('biomedika', 'B1', 'Bio Medika', 'Medical Services', 'BM', 'sponsor', 'booth-b1@natcon.id', '/logos/bio-medika.png', 'Agus Subroto', 'Champion'),
    ('parahitadiagnosticcenter', 'B2', 'Parahita Diagnostic Center', 'Health & Wellness Services', 'PD', 'sponsor', 'booth-b2@natcon.id', '/logos/parahita-diagnostic-center.png', 'Mizan Tamimy', 'Sovereign'),
    ('prosnap', 'B3', 'ProSnap', 'Business Consultant', 'P', 'sponsor', 'booth-b3@natcon.id', '/logos/prosnap.png', 'Leonard Rosandy', 'Star'),
    ('ptroyalmedicalinkpharmalabptaromabathiindonesia', 'C1', 'PT Royal Medicalink Pharmalab & PT Aroma Bathi Indonesia', 'Pharmaceutical Manufacturing', 'PR', 'sponsor', 'booth-c1@natcon.id', '/logos/royal-medicalink-pharmalab.png', 'Bu Dyah & Pak David Gani', '')
) AS v (key, booth, company, category, initials, kind, email, logo, contact, chapter)
WHERE t.booth = v.booth;

-- A crew that has not signed in yet goes back to the placeholder, so the
-- seeder derives their first password from the stand they are on NOW. A crew
-- that already chose its own password is left alone.
UPDATE users u
SET password_hash = '$2a$10$SEEDPLACEHOLDERSEEDPLACEHOLDERSEEDPLACEHOLDERSEEDPLACEH'
FROM tenants t
WHERE t.owner_user_id = u.id
  AND u.role = 'tenant'
  AND u.must_set_password = true;

-- ---------------------------------------------------------------- departures
-- Anything else that calls itself a booth or a sponsor is not on this floor
-- plan: a leftover from the sheet this migration replaces. The tenant row goes
-- first; its scanner login is behind a foreign key.
WITH removed AS (
    DELETE FROM tenants
    WHERE booth NOT IN ('A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A9', 'A10', 'A15', 'A14', 'A16', 'A17', 'A18 & A20', 'A19', 'A22', 'A23', 'A24', 'A25', 'A27', 'A30', 'A31', 'A32', 'A33', 'A34', 'A36', 'A37', 'A38', 'A42', 'A43', 'A44', 'A46', 'A47 & A48', 'A49', 'B1', 'B2', 'B3', 'C1')
      AND NOT EXISTS (SELECT 1 FROM visits v WHERE v.tenant_id = tenants.id)
    RETURNING owner_user_id
)
DELETE FROM users u
USING removed r
WHERE u.id = r.owner_user_id AND u.role = 'tenant';
