-- One chapter, one spelling. The ticketing export's "Bni Chapter" column
-- arrived in every variant the field allowed — "BNI Achievers" next to
-- "Achievers", "HERO" next to "Hero" — and the app listed both as if they
-- were different chapters. The rule (committee, 30 Aug 2026): drop the BNI
-- prefix (everything here is BNI) and collapse the remaining twins into the
-- friendliest spelling — mixed case beats ALL CAPS, the bare name beats the
-- decorated one. Two overseas chapters also wrote themselves two ways and
-- fold in explicitly:
--   BNI Malaysia Cheras Explorer Online -> Cheras Explorer Online
--   BNI Souq Arabia (Manama, Bahrain)   -> Souq Arabia
--
-- The passes update first, while both tables still hold the raw names; the
-- master list follows; a unique index on lower(name) keeps it this way.

WITH raw AS (
    SELECT name FROM chapters
    UNION
    SELECT DISTINCT chapter FROM users WHERE chapter <> ''
), keyed AS (
    SELECT name,
           btrim(regexp_replace(name, '^\s*BNI\s+', '', 'i')) AS base,
           CASE lower(btrim(regexp_replace(name, '^\s*BNI\s+', '', 'i')))
               WHEN 'malaysia cheras explorer online' THEN 'cheras explorer online'
               WHEN 'souq arabia (manama, bahrain)' THEN 'souq arabia'
               ELSE lower(btrim(regexp_replace(name, '^\s*BNI\s+', '', 'i')))
           END AS key
    FROM raw
), pick AS (
    SELECT DISTINCT ON (key) key, base AS canonical
    FROM keyed
    ORDER BY key, (base = upper(base)), (base = lower(base)), length(base), base
)
UPDATE users u
SET chapter = p.canonical
FROM keyed k
JOIN pick p USING (key)
WHERE u.chapter = k.name AND u.chapter <> p.canonical;

WITH raw AS (
    SELECT name FROM chapters
), keyed AS (
    SELECT name,
           btrim(regexp_replace(name, '^\s*BNI\s+', '', 'i')) AS base,
           CASE lower(btrim(regexp_replace(name, '^\s*BNI\s+', '', 'i')))
               WHEN 'malaysia cheras explorer online' THEN 'cheras explorer online'
               WHEN 'souq arabia (manama, bahrain)' THEN 'souq arabia'
               ELSE lower(btrim(regexp_replace(name, '^\s*BNI\s+', '', 'i')))
           END AS key
    FROM raw
), pick AS (
    SELECT DISTINCT ON (key) key, base AS canonical
    FROM keyed
    ORDER BY key, (base = upper(base)), (base = lower(base)), length(base), base
)
INSERT INTO chapters (name)
SELECT canonical FROM pick
ON CONFLICT (name) DO NOTHING;

WITH raw AS (
    SELECT name FROM chapters
), keyed AS (
    SELECT name,
           btrim(regexp_replace(name, '^\s*BNI\s+', '', 'i')) AS base,
           CASE lower(btrim(regexp_replace(name, '^\s*BNI\s+', '', 'i')))
               WHEN 'malaysia cheras explorer online' THEN 'cheras explorer online'
               WHEN 'souq arabia (manama, bahrain)' THEN 'souq arabia'
               ELSE lower(btrim(regexp_replace(name, '^\s*BNI\s+', '', 'i')))
           END AS key
    FROM raw
), pick AS (
    SELECT DISTINCT ON (key) key, base AS canonical
    FROM keyed
    ORDER BY key, (base = upper(base)), (base = lower(base)), length(base), base
)
DELETE FROM chapters
WHERE name NOT IN (SELECT canonical FROM pick);

CREATE UNIQUE INDEX IF NOT EXISTS chapters_name_lower_key ON chapters ((lower(name)));
