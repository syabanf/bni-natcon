-- The networking round, controlled by the committee (MoM 19 Aug 2026).
--
-- The countdown used to live in the attendee's browser: it started at 14:32
-- whenever the page loaded and looped back to 15:00 on reaching zero. Two
-- people standing next to each other saw different numbers, and a refresh
-- handed anyone a fresh round.
--
-- Now the round is a row. It starts when the committee presses the button,
-- it ends at a time everyone reads from the same place, and a refresh
-- changes nothing.
CREATE TABLE networking_sessions (
    id         BIGSERIAL PRIMARY KEY,
    round      INT NOT NULL,
    starts_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    ends_at    TIMESTAMPTZ NOT NULL,
    -- Set when the committee stops a round early; NULL means it ran, or is
    -- still running, to its own end.
    stopped_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT networking_session_ends_after_start CHECK (ends_at > starts_at)
);

-- "The live round" is a question about the clock, so it cannot be an index
-- predicate — Postgres will not index now(). The repository closes any
-- running round inside the same transaction that opens the next one, which
-- is the guarantee that matters: never two clocks on the wall.
CREATE INDEX networking_sessions_latest ON networking_sessions (starts_at DESC);
