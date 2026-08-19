-- A first draft of the day, so a fresh database opens on a schedule instead
-- of an empty page.
--
-- Only ever written into an empty rundown: a committee that has already typed
-- their own day keeps it, and a block deleted here never comes back on the
-- next restart. The Rundown page is where this gets corrected — these hours
-- come from the ticket window (3 September 2026, 07:30–18:30 WIB) and the
-- shape of the programme, not from a signed-off run-of-show.
--
-- Two learning blocks, because the MoM allows an attendee two classes as long
-- as they do not clash — a rule that means nothing while there is only one
-- learning hour in the day. Which class sits in which block is the
-- committee's call, so the classes are left unplaced.

INSERT INTO rundown (starts_at, ends_at, title, place, kind)
SELECT v.starts_at::timestamptz, v.ends_at::timestamptz, v.title, v.place, v.kind
FROM (VALUES
    ('2026-09-03 07:00:00+07', '2026-09-03 09:00:00+07',
     'Registration & Door Check-in', 'Main Lobby · collect your goodiebag and pin', 'registration'),
    ('2026-09-03 09:00:00+07', '2026-09-03 10:00:00+07',
     'Opening Ceremony', 'Grand Ballroom', 'plenary'),
    ('2026-09-03 10:00:00+07', '2026-09-03 12:00:00+07',
     'Plenary Session', 'Grand Ballroom', 'plenary'),
    ('2026-09-03 12:00:00+07', '2026-09-03 13:00:00+07',
     'Lunch & Booth Expo', 'Exhibition Foyer · collect your booth stamps', 'break'),
    ('2026-09-03 13:00:00+07', '2026-09-03 14:00:00+07',
     'Learning Class — Session 1', 'Learning Classes 1–4', 'learning'),
    ('2026-09-03 14:00:00+07', '2026-09-03 15:00:00+07',
     'Learning Class — Session 2', 'Learning Classes 1–4', 'learning'),
    ('2026-09-03 15:00:00+07', '2026-09-03 16:00:00+07',
     'Coffee Break & Booth Expo', 'Exhibition Foyer', 'break'),
    ('2026-09-03 16:00:00+07', '2026-09-03 17:00:00+07',
     'Speed Networking', 'Grand Ballroom · 8 people per table', 'networking'),
    ('2026-09-03 17:00:00+07', '2026-09-03 18:00:00+07',
     'Lucky Draw, Doorprize & Closing', 'Grand Ballroom', 'doorprize')
) AS v (starts_at, ends_at, title, place, kind)
WHERE NOT EXISTS (SELECT 1 FROM rundown);
