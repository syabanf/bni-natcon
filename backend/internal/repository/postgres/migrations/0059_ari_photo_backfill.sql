-- Catch-up for databases that ran 0058 in one of its earlier shapes —
-- the name landed before the photo did (and before one spelling fix), and
-- a migration already recorded does not run again. Idempotent everywhere:
-- a database seeded from the final files matches nothing here.

UPDATE seminars
SET moderator = 'Ari H. Handojo'
WHERE moderator = 'P. Ari Handojo';

UPDATE seminar_speakers
SET name = 'Ari H. Handojo'
WHERE name = 'P. Ari Handojo';

UPDATE seminar_speakers
SET photo_url = '/speakers/ari-h-handojo.jpg'
WHERE name = 'Ari H. Handojo' AND role = 'moderator' AND photo_url = '';
