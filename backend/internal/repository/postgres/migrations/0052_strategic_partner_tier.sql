-- Room for a "Strategic Partner" tier alongside the supporters.
--
-- The home screen shows the two headline tiers; everything below them lives
-- behind a "More partners" pop-up. This only widens what the tier column may
-- hold — no sponsor is added here, so the pop-up stays hidden until the
-- committee actually names partners.

ALTER TABLE sponsors DROP CONSTRAINT IF EXISTS sponsors_tier_check;
ALTER TABLE sponsors ADD CONSTRAINT sponsors_tier_check
    CHECK (tier IN ('diamond', 'platinum', 'strategic', 'supported'));

-- The passport and the admin list mark WHICH sponsor a stand is, not just
-- that it is one. The tier lives on the tenant as display data, set by the
-- stand the committee assigned: C1 is the Diamond stand, B1-B3 Platinum.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS sponsor_tier TEXT NOT NULL DEFAULT '';

UPDATE tenants SET sponsor_tier = 'diamond'  WHERE booth = 'C1' AND kind = 'sponsor';
UPDATE tenants SET sponsor_tier = 'platinum' WHERE booth IN ('B1', 'B2', 'B3') AND kind = 'sponsor';
