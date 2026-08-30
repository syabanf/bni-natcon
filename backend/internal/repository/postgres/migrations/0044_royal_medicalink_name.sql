-- The C1 stand's name, spelled the way the company spells it.
--
-- The committee's sheet has "T Royal Medicalink Pharmalab" — the P of PT went
-- missing somewhere in the typing, and it has been on the attendee passport
-- ever since. The generator now corrects it on the way through, so a rebuilt
-- database is already right; this is for the ones that are not rebuilt.
--
-- The stand is shared by two companies, which is why the name carries both.

UPDATE tenants
SET name = 'PT Royal Medicalink Pharmalab & PT Aroma Bathi Indonesia'
WHERE name = 'T Royal Medicalink Pharmalab & PT Aroma Bathi Indonesia';

-- The scanner login's display name follows the booth it belongs to.
UPDATE users u
SET name = t.name, company = t.name
FROM tenants t
WHERE t.owner_user_id = u.id
  AND t.name = 'PT Royal Medicalink Pharmalab & PT Aroma Bathi Indonesia'
  AND u.name <> t.name;
