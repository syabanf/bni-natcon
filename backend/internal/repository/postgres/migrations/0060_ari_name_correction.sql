-- The moderator's name is Ari H. Handojo — the committee's third and final
-- spelling. Databases that migrated under "Ari H. Hadojo" (0058/0059 in
-- their earlier shapes) carry the old name and the old photo path; both
-- come along. Idempotent: a database seeded from the final files matches
-- nothing here.

UPDATE seminars
SET moderator = 'Ari H. Handojo'
WHERE moderator IN ('Ari H. Hadojo', 'P. Ari Handojo');

UPDATE seminar_speakers
SET name = 'Ari H. Handojo'
WHERE name IN ('Ari H. Hadojo', 'P. Ari Handojo');

UPDATE seminar_speakers
SET photo_url = '/speakers/ari-h-handojo.jpg'
WHERE name = 'Ari H. Handojo'
  AND photo_url IN ('', '/speakers/ari-h-hadojo.jpg');
