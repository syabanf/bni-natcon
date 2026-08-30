-- The Strategic Partners, from the committee's own pack
-- (drive-download 30 August): eight companies, shown in the "More partners"
-- sheet ABOVE the supporters, in the order the pack was sent.
--
-- Idempotent by name, so a re-run or a committee edit survives.

INSERT INTO sponsors (tier, name, logo_url, sort)
SELECT v.tier, v.name, v.logo_url, v.sort
FROM (VALUES
    ('strategic', 'adalima — Balloon For You', '/sponsors/adalima.png', 10),
    ('strategic', 'GOLDROSE', '/sponsors/goldrose.png', 11),
    ('strategic', 'Bagz & Co.', '/sponsors/bagz-n-co.png', 12),
    ('strategic', 'Ballooney', '/sponsors/ballooney.png', 13),
    ('strategic', 'CMI', '/sponsors/cmi.png', 14),
    ('strategic', 'Jun''s Production', '/sponsors/juns-production.png', 15),
    ('strategic', 'Sierra', '/sponsors/sierra.png', 16),
    ('strategic', 'SORA System', '/sponsors/sora-system.png', 17)
) AS v (tier, name, logo_url, sort)
WHERE NOT EXISTS (SELECT 1 FROM sponsors s WHERE lower(s.name) = lower(v.name));
