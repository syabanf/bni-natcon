-- Chapters as first-class master data. The list is not written here:
-- every attendee import registers the chapters it meets, so the master
-- list is exactly what the committee's own sheet contains.
CREATE TABLE chapters (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
