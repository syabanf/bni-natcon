-- A stand can be shared by more than one company.
--
-- C1 is the case that forced this: PT Royal Medicalink Pharmalab and PT Aroma
-- Bathi Indonesia share it. Until now both names lived in one `name` column
-- joined by an ampersand, with room for exactly one logo — so the passport
-- showed one company's mark above two companies' names.
--
-- WHAT THIS DOES NOT CHANGE: a stand is still one tenant. One scanner login,
-- one QR, one stamp in the passport, and it counts once towards the draw's
-- booth minimum. Two companies sharing a stand did not buy two stamps. This
-- table is what the CARD shows, not what the scan counts.
--
-- Two shapes already in the data that this must not confuse:
--   · "Lisanna Online Accounting & Tax Consultant" is ONE company whose name
--     happens to contain an ampersand — splitting on '&' would invent a
--     company called "Tax Consultant".
--   · "A18 & A20" is one company on TWO STANDS, which is the opposite case
--     and already handled by the booth label.
-- So nothing is split automatically. Every tenant gets one company row from
-- its own name, and the one stand that genuinely holds two is listed by hand.

CREATE TABLE IF NOT EXISTS tenant_companies (
    id        BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    name      TEXT   NOT NULL,
    -- Empty falls back to the tenant's own mark, then to initials.
    logo_url  TEXT   NOT NULL DEFAULT '',
    sort      INT    NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS tenant_companies_tenant_idx
    ON tenant_companies (tenant_id, sort);

-- One row per exhibitor, from what the tenant already carries.
INSERT INTO tenant_companies (tenant_id, name, logo_url, sort)
SELECT t.id, t.name, t.logo_url, 0
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM tenant_companies c WHERE c.tenant_id = t.id);

-- C1, by hand, because it is the one the committee named. The first row keeps
-- Royal Medicalink's logo; the second waits for Aroma Bathi's artwork and
-- shows the company name until it arrives.
UPDATE tenant_companies c
SET name = 'PT Royal Medicalink Pharmalab'
FROM tenants t
WHERE t.id = c.tenant_id
  AND t.name = 'PT Royal Medicalink Pharmalab & PT Aroma Bathi Indonesia'
  AND c.sort = 0;

INSERT INTO tenant_companies (tenant_id, name, logo_url, sort)
SELECT t.id, 'PT Aroma Bathi Indonesia', '', 1
FROM tenants t
WHERE t.name = 'PT Royal Medicalink Pharmalab & PT Aroma Bathi Indonesia'
  AND NOT EXISTS (
      SELECT 1 FROM tenant_companies c
      WHERE c.tenant_id = t.id AND c.name = 'PT Aroma Bathi Indonesia');
