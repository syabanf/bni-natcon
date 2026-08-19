-- The morning after.
--
-- 66 of the tickets in the ticketing export are not for the conference day at
-- all: they read "04 Sep '26 08:00 - 11:00" and are Gold Club Breakfast
-- tickets. The rundown had nowhere to put that, so the breakfast existed on
-- the tickets and nowhere in the app.
--
-- The agenda is one list for everybody, so the block says plainly who it is
-- for rather than pretending to be part of everyone's day. Filtering the
-- agenda by ticket type would need the ticket type imported and an audience
-- on each block; until the committee asks for that, saying so in the block is
-- honest and costs nobody a redeploy.

INSERT INTO rundown (starts_at, ends_at, title, place, kind)
SELECT '2026-09-04 08:00:00+07'::timestamptz, '2026-09-04 11:00:00+07'::timestamptz,
       'Gold Club Breakfast',
       'Gold Club ticket holders only · see your ticket for the room',
       'break'
WHERE NOT EXISTS (
    SELECT 1 FROM rundown WHERE starts_at >= '2026-09-04 00:00:00+07'
                            AND starts_at <  '2026-09-05 00:00:00+07');
