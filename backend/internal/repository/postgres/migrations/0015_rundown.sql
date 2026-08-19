-- The event's own schedule, in one-hour blocks (MoM 19 Aug 2026).
--
-- Until now the agenda was hard-coded in the attendee app and the classes
-- carried no time at all, which is why "two sessions that do not clash" could
-- not be checked: nothing knew when anything happened.
--
-- Blocks are stored as real timestamps rather than "13:00" strings so that
-- overlap is a comparison instead of string parsing, and so a block that runs
-- past midnight or gets moved by an hour needs no special case.

CREATE TABLE rundown (
    id         BIGSERIAL PRIMARY KEY,
    starts_at  TIMESTAMPTZ NOT NULL,
    ends_at    TIMESTAMPTZ NOT NULL,
    title      TEXT NOT NULL,
    place      TEXT NOT NULL DEFAULT '',
    -- What happens in the block. 'learning' blocks are the ones a class can
    -- be attached to; the rest are informational for the attendee agenda.
    kind       TEXT NOT NULL DEFAULT 'plenary'
               CHECK (kind IN ('registration', 'plenary', 'learning',
                               'networking', 'break', 'doorprize')),
    sort       INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT rundown_ends_after_start CHECK (ends_at > starts_at)
);

CREATE INDEX rundown_starts_idx ON rundown (starts_at);

-- A class runs inside a block. NULL keeps every existing class valid: the
-- committee assigns the blocks once the rundown is filled in.
ALTER TABLE seminars ADD COLUMN rundown_id BIGINT REFERENCES rundown (id) ON DELETE SET NULL;

CREATE INDEX seminars_rundown_idx ON seminars (rundown_id) WHERE rundown_id IS NOT NULL;

-- The class banner stays landscape (it fills a wide card); the poster is the
-- portrait artwork shown on the class detail page. Two pictures, because one
-- cropped to both shapes always loses something (MoM 19 Aug 2026).
ALTER TABLE seminars ADD COLUMN poster_url TEXT NOT NULL DEFAULT '';
