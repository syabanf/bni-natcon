-- Failed sign-in attempts, counted for the whole fleet rather than per
-- process.
--
-- The limiter that stops password guessing lived in one API process's memory.
-- That was right while the API was one container; behind a load balancer it
-- silently multiplies — three instances mean three separate counters and
-- thirty guesses a minute instead of ten, and which one an attacker lands on
-- is up to the balancer. The count belongs in the one place every instance
-- already shares.
--
-- Only FAILURES are written, so this table stays small: a hall of people
-- typing their own password correctly never touches it.

CREATE TABLE IF NOT EXISTS auth_failures (
    id      BIGSERIAL PRIMARY KEY,
    -- The account under attack: an email, or a chapter and phone number.
    key     TEXT        NOT NULL,
    failed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The only query that runs on the login path: how many failures for this key
-- inside the window. DESC because it is always the recent end that is read.
CREATE INDEX IF NOT EXISTS auth_failures_key_time_idx
    ON auth_failures (key, failed_at DESC);

-- The sweep that drops aged-out rows reads by time, not by key.
CREATE INDEX IF NOT EXISTS auth_failures_time_idx ON auth_failures (failed_at);
