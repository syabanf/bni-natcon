-- Log every table check-in so members can see where they've networked.
CREATE TABLE networking_table_history (
    id         BIGSERIAL PRIMARY KEY,
    member_id  BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    table_no   INT NOT NULL,
    hall       TEXT NOT NULL DEFAULT 'Hall B',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX networking_table_history_member_idx
    ON networking_table_history (member_id, created_at DESC);
