-- The committee's own artwork for the learning classes.
--
-- Until now each class carried a generated gradient cover; these are the real
-- banners, with the speakers photographed on the conference backdrop. One per
-- class, prepared by scripts/class_covers.py and shipped with the apps rather
-- than living on the upload volume, so they survive a redeploy.
--
-- Only a shipped cover is replaced. A cover the committee uploaded through
-- the admin panel is theirs and stays.

UPDATE seminars s
SET cover_url = v.cover
FROM (VALUES
    ('Learning Class 1', '/covers/learning-class-1.jpg'),  -- Flavia Norpina Sungkit
    ('Learning Class 2', '/covers/learning-class-2.jpg'),  -- Viktor Iwan & Irfan Arsandi
    ('Learning Class 3', '/covers/learning-class-3.jpg'),  -- Ben Wirawan & Selina Nicole
    ('Learning Class 4', '/covers/learning-class-4.jpg')   -- Suntoro Suciatmaja
) AS v (room, cover)
WHERE s.room = v.room
  AND (s.cover_url = '' OR s.cover_url LIKE '/covers/%')
  AND s.cover_url <> v.cover;
