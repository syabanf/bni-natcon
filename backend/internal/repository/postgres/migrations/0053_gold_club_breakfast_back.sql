-- The morning after, again.
--
-- 0048 rebuilt the rundown from the run-of-show artwork with DELETE FROM
-- rundown — and the artwork is the 3 September day only, so the Gold Club
-- Breakfast that 0025 added for 4 September (66 real tickets: "04 Sep '26
-- 08:00 - 11:00") went with it. The breakfast is on the tickets whether the
-- poster prints it or not; put it back, guarded the same way 0025 was so a
-- committee that deletes it on the Rundown page is not overruled on the next
-- restart.

INSERT INTO rundown (starts_at, ends_at, title, place, kind)
SELECT '2026-09-04 08:00:00+07'::timestamptz, '2026-09-04 11:00:00+07'::timestamptz,
       'Gold Club Breakfast',
       'Gold Club ticket holders only · see your ticket for the room',
       'break'
WHERE NOT EXISTS (
    SELECT 1 FROM rundown WHERE starts_at >= '2026-09-04 00:00:00+07'
                            AND starts_at <  '2026-09-05 00:00:00+07');
