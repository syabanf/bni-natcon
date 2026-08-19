-- Pin and goodiebag are handed over at a desk, and both are now scanned
-- rather than ticked (MoM 19 Aug 2026).
--
-- Timestamps, not booleans: "redeemed" is the question anyone asks, but
-- "when" is the one that settles an argument at the desk — and a timestamp
-- answers both. NULL means not yet.
ALTER TABLE users ADD COLUMN pin_redeemed_at       TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN goodiebag_redeemed_at TIMESTAMPTZ;

-- The desk counts what it has handed out; both reports read these.
CREATE INDEX users_pin_redeemed_idx ON users (pin_redeemed_at) WHERE pin_redeemed_at IS NOT NULL;
CREATE INDEX users_goodiebag_redeemed_idx ON users (goodiebag_redeemed_at) WHERE goodiebag_redeemed_at IS NOT NULL;
