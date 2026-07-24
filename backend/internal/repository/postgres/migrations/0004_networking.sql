CREATE TABLE networking_tables (
    id       BIGSERIAL PRIMARY KEY,
    table_no INT NOT NULL UNIQUE,
    hall     TEXT NOT NULL DEFAULT 'Hall B',
    capacity INT NOT NULL DEFAULT 8
);

INSERT INTO networking_tables (table_no)
SELECT generate_series(1, 12);

CREATE TABLE networking_checkins (
    id         BIGSERIAL PRIMARY KEY,
    table_id   BIGINT NOT NULL REFERENCES networking_tables (id) ON DELETE CASCADE,
    member_id  BIGINT NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    seat_no    INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX networking_checkins_table_idx ON networking_checkins (table_id);

CREATE TABLE networking_contacts (
    id         BIGSERIAL PRIMARY KEY,
    owner_id   BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    contact_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (owner_id, contact_id)
);
