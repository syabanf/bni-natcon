-- The committee's rundown poster (3 September 2026, Pullman Hotel Jakarta),
-- so a fresh database opens on the real schedule instead of an empty page.
--
-- Only ever written into an empty rundown: a committee that has already typed
-- their own day keeps it, and a block deleted here never comes back on the
-- next restart. The Rundown admin page stays the place to correct it.
--
-- Two learning blocks (08:00 and 10:00), each carrying two parallel classes —
-- the MoM's "two classes as long as they do not clash" rule now has real
-- hours to check against. The speakers live in `place` because the home
-- agenda renders it as the block's subtitle. Chapter Photo Session and
-- Learning Session 1 share an 08:00 start (they run in parallel), so `sort`
-- keeps the poster's order; Coffee Break 1 floats inside the learning hour.

INSERT INTO rundown (starts_at, ends_at, title, place, kind, sort)
SELECT v.starts_at::timestamptz, v.ends_at::timestamptz, v.title, v.place, v.kind, v.sort
FROM (VALUES
    ('2026-09-03 07:00:00+07', '2026-09-03 08:00:00+07',
     'Registration & Open Networking', 'Main Lobby · collect your goodiebag and pin', 'registration', 0),
    ('2026-09-03 08:00:00+07', '2026-09-03 08:30:00+07',
     'Chapter Photo Session', '', 'plenary', 0),
    ('2026-09-03 08:00:00+07', '2026-09-03 10:00:00+07',
     'Learning Session 1',
     'Your Face Tells a Story — Suntoro Suciatmaja · Work-Life Balance & AI — Viktor Iwan & Irfan Arsandi',
     'learning', 1),
    ('2026-09-03 08:30:00+07', '2026-09-03 09:00:00+07',
     'Coffee Break 1', '', 'break', 2),
    ('2026-09-03 10:00:00+07', '2026-09-03 11:00:00+07',
     'Learning Session 2',
     'Navigating the Mid-Market HR Squeeze — Flavia Norpina Sungkit · How to Win in Retail — Ben Wirawan & Selina Nicole',
     'learning', 0),
    ('2026-09-03 11:00:00+07', '2026-09-03 12:15:00+07',
     'Lunch Break', '', 'break', 0),
    ('2026-09-03 12:15:00+07', '2026-09-03 14:00:00+07',
     'Opening Ceremony',
     'Welcome Address — Eddy Sugiri · Special Message — Dr. Ivan Misner · Special Message — Mary Kennedy Thompson',
     'plenary', 0),
    ('2026-09-03 14:00:00+07', '2026-09-03 15:15:00+07',
     'Keynote Speaker Session', 'Phil Berg', 'plenary', 0),
    ('2026-09-03 15:15:00+07', '2026-09-03 15:30:00+07',
     'Coffee Break 2', '', 'break', 0),
    ('2026-09-03 15:30:00+07', '2026-09-03 16:10:00+07',
     'Speed Networking Session 1', 'Your Dream Referral', 'networking', 0),
    ('2026-09-03 16:10:00+07', '2026-09-03 16:50:00+07',
     'Chapter Awards', 'Director & Ambassador Awards', 'plenary', 0),
    ('2026-09-03 16:50:00+07', '2026-09-03 17:00:00+07',
     'Door Prize 1', '', 'doorprize', 0),
    ('2026-09-03 17:00:00+07', '2026-09-03 17:35:00+07',
     'Speed Networking Session 2', 'Your Dream Referral', 'networking', 0),
    ('2026-09-03 17:35:00+07', '2026-09-03 18:20:00+07',
     'Referral Partner Awards', '', 'plenary', 0),
    ('2026-09-03 18:20:00+07', '2026-09-03 18:30:00+07',
     'Door Prize 2', '', 'doorprize', 0),
    ('2026-09-03 18:30:00+07', '2026-09-03 19:00:00+07',
     'Closing', '', 'plenary', 0)
) AS v (starts_at, ends_at, title, place, kind, sort)
WHERE NOT EXISTS (SELECT 1 FROM rundown);
