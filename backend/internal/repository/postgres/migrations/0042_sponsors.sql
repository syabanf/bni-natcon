-- The sponsor wall: 27 companies across three tiers.
--
-- A SPONSOR IS NOT AN EXHIBITOR, and that is why this is its own table rather
-- than more rows in `tenants`. Twenty-five of these have no stand, no scanner
-- login and nothing to stamp; putting them in `tenants` would have told every
-- attendee they had visited 0 of 61 booths and quietly moved the draw's
-- booth minimum out of reach.
--
-- Two of them exhibit as well — Parahita on B2, Royal Medicalink on C1 — and
-- appear in both places. That is what sponsoring and exhibiting at the same
-- event looks like; the passport lists the stand, the wall lists the sponsor.
--
-- Tier decides the order, and the order is the point: Diamond above Platinum
-- above the supporters. `sort` keeps each tier in the sequence the committee
-- sent the artwork in, so a company does not move because somebody renamed a
-- file.

CREATE TABLE IF NOT EXISTS sponsors (
    id       BIGSERIAL PRIMARY KEY,
    tier     TEXT NOT NULL CHECK (tier IN ('diamond', 'platinum', 'supported')),
    name     TEXT NOT NULL,
    logo_url TEXT NOT NULL DEFAULT '',
    sort     INT  NOT NULL DEFAULT 0
);

-- One row per company: the packs ship two takes of some logos, not two
-- sponsors.
CREATE UNIQUE INDEX IF NOT EXISTS sponsors_name_key ON sponsors (lower(name));

-- Written only into an empty wall, the same rule the rundown seed follows: a
-- committee that has since corrected a name or dropped a sponsor keeps their
-- edit, and a row deleted here never comes back on the next restart.
INSERT INTO sponsors (tier, name, logo_url, sort)
SELECT v.tier, v.name, v.logo_url, v.sort
FROM (VALUES
    ('diamond', 'ZOHO', '/sponsors/zoho.png', 0),
    ('diamond', 'PT. ROYAL MEDICALINK PHARMALAB', '/sponsors/royal-medicalink-pharmalab.png', 1),
    ('diamond', 'SCREEN TECHLETICA', '/sponsors/screen-techletica.png', 2),
    ('platinum', 'ACTION COACH', '/sponsors/action-coach.png', 3),
    ('platinum', 'PARAHITA', '/sponsors/parahita.png', 4),
    ('platinum', 'OCBC', '/sponsors/ocbc.png', 5),
    ('supported', 'Padigiling', '/sponsors/padigiling.png', 6),
    ('supported', 'Jclass', '/sponsors/jclass.png', 7),
    ('supported', 'SAFA photowork', '/sponsors/safa-photowork.png', 8),
    ('supported', 'Kreasi Pesona Ekspresi', '/sponsors/kreasi-pesona-ekspresi.png', 9),
    ('supported', 'HIghANgle', '/sponsors/highangle.png', 10),
    ('supported', 'Majus', '/sponsors/majus.png', 11),
    ('supported', 'GLO', '/sponsors/glo.png', 12),
    ('supported', 'Video Core Value', '/sponsors/video-core-value.png', 13),
    ('supported', 'Rusli Hadiwinata', '/sponsors/rusli-hadiwinata.png', 14),
    ('supported', 'TABULLA', '/sponsors/tabulla.png', 15),
    ('supported', 'Tinta', '/sponsors/tinta.png', 16),
    ('supported', 'Dante Planner', '/sponsors/dante-planner.png', 17),
    ('supported', 'TIGERHEAD', '/sponsors/tigerhead.png', 18),
    ('supported', 'Lotus Design', '/sponsors/lotus-design.png', 19),
    ('supported', 'Increasink', '/sponsors/increasink.png', 20),
    ('supported', 'GOERS', '/sponsors/goers.png', 21),
    ('supported', 'cocomodo', '/sponsors/cocomodo.png', 22),
    ('supported', 'integra', '/sponsors/integra.png', 23),
    ('supported', 'venom c', '/sponsors/venom-c.png', 24),
    ('supported', 'MC Uya', '/sponsors/mc-uya.png', 25),
    ('supported', 'Purityfic', '/sponsors/purityfic.png', 26)
) AS v (tier, name, logo_url, sort)
WHERE NOT EXISTS (SELECT 1 FROM sponsors);
