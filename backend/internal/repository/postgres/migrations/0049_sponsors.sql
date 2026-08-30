-- The sponsor wall: five companies, from the committee's final packs
-- (01_DIAMond and 02_PLATINUM, 30 August).
--
-- This replaces migration 0042, which had seeded 27 from an earlier trio of
-- packs — those turned out to be for something else. The wall is now two
-- Diamond and three Platinum sponsors, and every one of them also exhibits:
-- Royal Medicalink and Aroma Bathi share C1, Parahita is B2, Bio Medika B1,
-- ProSnap B3. Appearing in both places is what sponsoring and exhibiting at
-- the same event looks like — the wall is a thank-you, the passport is a
-- game of stamps, and neither borrows from the other.
--
-- Runs on a database that has 27, or 2, or none: the DELETE clears whatever
-- an earlier seed put here, the INSERT is keyed on the name.

CREATE TABLE IF NOT EXISTS sponsors (
    id       BIGSERIAL PRIMARY KEY,
    tier     TEXT NOT NULL CHECK (tier IN ('diamond', 'platinum', 'supported')),
    name     TEXT NOT NULL,
    logo_url TEXT NOT NULL DEFAULT '',
    sort     INT  NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS sponsors_name_key ON sponsors (lower(name));

DELETE FROM sponsors
WHERE lower(name) NOT IN
    ('pt. royal medicalink pharmalab', 'aroma bathi', 'bio medika', 'parahita', 'prosnap');

INSERT INTO sponsors (tier, name, logo_url, sort)
SELECT v.tier, v.name, v.logo_url, v.sort
FROM (VALUES
    ('diamond',  'PT. ROYAL MEDICALINK PHARMALAB', '/sponsors/royal-medicalink-pharmalab.png', 0),
    ('diamond',  'Aroma Bathi',                    '/sponsors/aroma-bathi.png',                1),
    ('platinum', 'BIO MEDIKA',                     '/sponsors/bio-medika.png',                 2),
    ('platinum', 'PARAHITA',                       '/sponsors/parahita.png',                   3),
    ('platinum', 'ProSnap',                        '/sponsors/prosnap.png',                    4)
) AS v (tier, name, logo_url, sort)
WHERE NOT EXISTS (SELECT 1 FROM sponsors s WHERE lower(s.name) = lower(v.name));

-- Every sponsor row keeps the CURRENT artwork and tier, whichever seed put it
-- there first.
UPDATE sponsors s
SET tier = v.tier, logo_url = v.logo_url, sort = v.sort
FROM (VALUES
    ('diamond',  'PT. ROYAL MEDICALINK PHARMALAB', '/sponsors/royal-medicalink-pharmalab.png', 0),
    ('diamond',  'Aroma Bathi',                    '/sponsors/aroma-bathi.png',                1),
    ('platinum', 'BIO MEDIKA',                     '/sponsors/bio-medika.png',                 2),
    ('platinum', 'PARAHITA',                       '/sponsors/parahita.png',                   3),
    ('platinum', 'ProSnap',                        '/sponsors/prosnap.png',                    4)
) AS v (tier, name, logo_url, sort)
WHERE lower(s.name) = lower(v.name)
  AND (s.tier <> v.tier OR s.logo_url <> v.logo_url OR s.sort <> v.sort);
