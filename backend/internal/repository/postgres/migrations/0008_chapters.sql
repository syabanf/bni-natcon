-- Chapters as first-class master data, fed by member imports/CRUD.
CREATE TABLE chapters (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Backfill from members that already carry a chapter string.
INSERT INTO chapters (name)
SELECT DISTINCT chapter FROM users
WHERE role = 'member' AND chapter <> ''
ON CONFLICT (name) DO NOTHING;
