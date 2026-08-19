-- The door crew get their own accounts and their own app (MoM 19 Aug 2026).
--
-- Until now the only way to work a class door was to hand somebody the
-- committee's admin login — which also opens the attendee list, the master
-- data and the draws. A door account can do exactly one job.
ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('member', 'tenant', 'admin', 'door'));
