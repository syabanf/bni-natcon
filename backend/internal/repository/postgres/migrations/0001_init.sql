CREATE TABLE users (
    id            BIGSERIAL PRIMARY KEY,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('member', 'tenant')),
    member_code   TEXT UNIQUE,
    chapter       TEXT NOT NULL DEFAULT '',
    company       TEXT NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tenants (
    id            BIGSERIAL PRIMARY KEY,
    name          TEXT NOT NULL,
    category      TEXT NOT NULL,
    booth         TEXT NOT NULL,
    initials      TEXT NOT NULL,
    owner_user_id BIGINT NOT NULL UNIQUE REFERENCES users (id)
);

CREATE TABLE visits (
    id         BIGSERIAL PRIMARY KEY,
    tenant_id  BIGINT NOT NULL REFERENCES tenants (id),
    member_id  BIGINT NOT NULL REFERENCES users (id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, member_id)
);

CREATE INDEX visits_member_idx ON visits (member_id);
CREATE INDEX visits_tenant_created_idx ON visits (tenant_id, created_at DESC);

CREATE TABLE seminars (
    id       BIGSERIAL PRIMARY KEY,
    slot     INT NOT NULL,
    room     TEXT NOT NULL,
    title    TEXT NOT NULL,
    speaker  TEXT NOT NULL,
    capacity INT NOT NULL
);

CREATE TABLE seminar_registrations (
    id         BIGSERIAL PRIMARY KEY,
    seminar_id BIGINT NOT NULL REFERENCES seminars (id),
    member_id  BIGINT NOT NULL REFERENCES users (id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (seminar_id, member_id)
);

CREATE INDEX seminar_registrations_member_idx ON seminar_registrations (member_id);
