-- Two draws, not one, and both with a record that survives a page reload
-- (MoM 19 Aug 2026).
--
-- Until now the winners lived in the browser's memory. A reload on stage —
-- a dropped wifi, a closed lid, a curious finger — emptied the list, and the
-- next spin could hand the same person a second prize in front of the room.
CREATE TABLE draws (
    key               TEXT PRIMARY KEY CHECK (key IN ('lucky', 'doorprize')),
    name              TEXT NOT NULL,
    -- How many booths someone must have visited to be in this draw. 0 means
    -- everyone registered is in it, which is where both start.
    min_booth_visits  INT NOT NULL DEFAULT 0 CHECK (min_booth_visits >= 0),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO draws (key, name) VALUES
    ('lucky', 'Lucky Draw'),
    ('doorprize', 'Doorprize');

CREATE TABLE draw_winners (
    id        BIGSERIAL PRIMARY KEY,
    draw_key  TEXT NOT NULL REFERENCES draws (key) ON DELETE CASCADE,
    member_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    position  INT NOT NULL,
    won_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Nobody wins the same draw twice, whatever the browser thinks.
    UNIQUE (draw_key, member_id)
);

CREATE INDEX draw_winners_draw_idx ON draw_winners (draw_key, position);
