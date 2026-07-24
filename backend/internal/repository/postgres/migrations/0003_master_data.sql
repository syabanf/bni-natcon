-- Cascade deletes so removing master data cleans up dependent rows.
ALTER TABLE visits
    DROP CONSTRAINT visits_tenant_id_fkey,
    ADD CONSTRAINT visits_tenant_id_fkey
        FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE CASCADE;
ALTER TABLE visits
    DROP CONSTRAINT visits_member_id_fkey,
    ADD CONSTRAINT visits_member_id_fkey
        FOREIGN KEY (member_id) REFERENCES users (id) ON DELETE CASCADE;
ALTER TABLE seminar_registrations
    DROP CONSTRAINT seminar_registrations_seminar_id_fkey,
    ADD CONSTRAINT seminar_registrations_seminar_id_fkey
        FOREIGN KEY (seminar_id) REFERENCES seminars (id) ON DELETE CASCADE;
ALTER TABLE seminar_registrations
    DROP CONSTRAINT seminar_registrations_member_id_fkey,
    ADD CONSTRAINT seminar_registrations_member_id_fkey
        FOREIGN KEY (member_id) REFERENCES users (id) ON DELETE CASCADE;

-- Member codes for admin-created members continue after the seeded range.
CREATE SEQUENCE member_code_seq START 9001;
