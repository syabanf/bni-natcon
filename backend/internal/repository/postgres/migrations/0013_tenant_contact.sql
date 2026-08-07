-- The official booth sheet names the BNI member manning each booth and the
-- chapter they belong to. Both are worth showing: attendees recognise people
-- before they recognise company names.
ALTER TABLE tenants ADD COLUMN contact_name TEXT NOT NULL DEFAULT '';
ALTER TABLE tenants ADD COLUMN chapter TEXT NOT NULL DEFAULT '';
