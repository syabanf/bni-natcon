-- Point every stand at the artwork from the committee's final booth pack
-- (Transp Booth Logo + the sponsor packs, 30 August).
--
-- Matched on the EXACT company name, one row per exhibitor, taken straight
-- from scripts/booth-logos.json — the same file the generator reads, so a
-- rebuilt database and an upgraded one cannot disagree about a logo. A few
-- files changed names with the new pack, and Aroma Bathi finally sent a
-- mark.

UPDATE tenants t
SET logo_url = v.url
FROM (VALUES
    ('ALPHA LEADERS', '/logos/alpha-leaders.png'),
    ('Alps Wills Pte Ltd', '/logos/alps-wills.png'),
    ('BOOKINGTOGO', '/logos/bookingtogo.png'),
    ('Bio Medika', '/logos/bio-medika.png'),
    ('CV IT Pro Solutions', '/logos/it-pro-solutions.png'),
    ('CV WIRABUANA SAKTI', '/logos/wirabuana-sakti.png'),
    ('CV. TRIANA BINTANG', '/logos/triana-bintang.png'),
    ('Doxadigital', '/logos/doxadigital.png'),
    ('GrasiaCare', '/logos/grasiacare.png'),
    ('ICUBE (Invoice ke PT)', '/logos/icube.png'),
    ('KETAPANG INDAH HOTEL', '/logos/ketapang-indah-hotel.png'),
    ('LEKA (PT Tissor Indonesia)', '/logos/leka-tissor-indonesia.png'),
    ('Lisanna Online Accounting & Tax Consultant', '/logos/lisanna-online-accounting.png'),
    ('One Tax CM Pte Ltd', '/logos/one-tax-cm.png'),
    ('PAKS (MM2H) SDN BHD', '/logos/paks-mm2h.png'),
    ('PT Belanja Segar Indonesia', '/logos/belanja-segar-indonesia.png'),
    ('PT Documenta Corpora Technology', '/logos/documenta-corpora-technology.png'),
    ('PT ForBis Asia Indonesia', '/logos/forbis-asia-indonesia.png'),
    ('PT Natural Spirit', '/logos/natural-spirit.png'),
    ('PT Royal Medicalink Pharmalab & PT Aroma Bathi Indonesia', '/logos/royal-medicalink-pharmalab.png'),
    ('PT Tanamera Mitra Sentosa', '/logos/tanamera-mitra-sentosa.png'),
    ('PT Zona Kreatif Indonesia', '/logos/zona-kreatif-indonesia.png'),
    ('PT. Creative Media Indonesia', '/logos/creative-media-indonesia.png'),
    ('PT. Gunanusa Eramandiri Tbk', '/logos/gunanusa-eramandiri.png'),
    ('PT. Norita Flexindo', '/logos/norita-flexindo.png'),
    ('PT. ORIENTAL LOGISTICS INDONESIA', '/logos/oriental-logistics-indonesia.png'),
    ('PT. TSN Ariestama Jaya', '/logos/tsn-ariestama-jaya.png'),
    ('PT. Venamon', '/logos/venamon.png'),
    ('Paper.id', '/logos/paper-id.png'),
    ('Parahita Diagnostic Center', '/logos/parahita-diagnostic-center.png'),
    ('ProSnap', '/logos/prosnap.png'),
    ('SSCX International', '/logos/sscx-international.png'),
    ('Sinar Printing (PT Sinar Media Kreasi)', '/logos/sinar-printing-sinar.png'),
    ('ToffeeDev', '/logos/toffeedev.png'),
    ('WIT.ID', '/logos/wit-id.png'),
    ('inHARMONY Preventive Clinic', '/logos/inharmony-preventive-clinic.png')
) AS v (name, url)
WHERE t.name = v.name
  AND t.logo_url <> v.url;

-- The companies on each stand mirror the stand's own mark...
UPDATE tenant_companies c
SET logo_url = t.logo_url
FROM tenants t
WHERE t.id = c.tenant_id
  AND c.name = t.name
  AND c.logo_url <> t.logo_url;

-- ...except C1, where each of the two companies has its own.
UPDATE tenant_companies c
SET logo_url = '/logos/aroma-bathi.png'
FROM tenants t
WHERE t.id = c.tenant_id
  AND c.name = 'PT Aroma Bathi Indonesia'
  AND c.logo_url <> '/logos/aroma-bathi.png';
