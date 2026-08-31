-- Learning Session 4 gets its moderator, like the other three sessions:
-- Ari H. Hadojo, from the committee (30 Aug 2026).
--
-- The classes are seeded by Go code after migrations, so on a fresh
-- database this matches nothing and the seed itself carries the name
-- and photo;
-- this UPDATE is for databases whose classes already exist (and it stays
-- clear of a class the committee has since edited by hand).

UPDATE seminars
SET moderator = 'Ari H. Hadojo'
WHERE room = 'Learning Session 4' AND moderator = '';

INSERT INTO seminar_speakers (seminar_id, name, role, title, photo_url, sort)
SELECT s.id, 'Ari H. Hadojo', 'moderator', '', '/speakers/ari-h-hadojo.jpg',
       COALESCE((SELECT max(sort) + 1 FROM seminar_speakers WHERE seminar_id = s.id), 0)
FROM seminars s
WHERE s.room = 'Learning Session 4'
  AND s.moderator = 'Ari H. Hadojo'
  AND NOT EXISTS (
      SELECT 1 FROM seminar_speakers
      WHERE seminar_id = s.id AND role = 'moderator'
  );
