-- The committee's signed-off run of show for 3 September.
--
-- This replaces the draft migration 0024 wrote from the ticket window and the
-- shape of the programme. That draft guessed nine one-hour blocks ending at
-- 18:00; the real day is the one below, and it is shorter — the published
-- rundown ends with the Opening Ceremony.
--
-- The 4 September Gold Club Breakfast (migration 0025) is a different day and
-- is left alone.
--
-- TWO THINGS HAPPEN HERE, and the second is the one that matters to an
-- attendee: the four classes are placed into the two learning blocks. Until
-- now all four sat in one slot, so picking one used up the allowance and the
-- second was refused. The clash rule reads the block's HOURS, so placing them
-- is what makes "two classes, as long as they do not overlap" actually work.

DELETE FROM rundown WHERE starts_at::date = DATE '2026-09-03';

INSERT INTO rundown (starts_at, ends_at, title, place, kind) VALUES
    ('2026-09-03 07:00:00+07', '2026-09-03 08:00:00+07',
     'Registration Open + Networking', 'Main Lobby', 'registration'),
    ('2026-09-03 08:00:00+07', '2026-09-03 08:30:00+07',
     'Chapter Photo Session', '', 'plenary'),
    -- The two learning blocks. Each holds two classes running in parallel, so
    -- an attendee takes one from each block and leaves with two.
    ('2026-09-03 08:00:00+07', '2026-09-03 10:00:00+07',
     'Learning Session 1', 'Your Face Tell a Story · Work-Life Balance AI', 'learning'),
    ('2026-09-03 08:30:00+07', '2026-09-03 10:00:00+07',
     'Coffee Break 1', '', 'break'),
    ('2026-09-03 10:00:00+07', '2026-09-03 11:00:00+07',
     'Learning Session 2', 'Navigating the Mid-Market HR Squeeze · How to Win in Retail', 'learning'),
    ('2026-09-03 11:00:00+07', '2026-09-03 12:15:00+07',
     'Lunch Break', '', 'break'),
    -- The published rundown gives no finishing time for the ceremony; 13:30
    -- is room for the three addresses on it. The Rundown page is where the
    -- committee corrects that without a redeploy.
    ('2026-09-03 12:15:00+07', '2026-09-03 13:30:00+07',
     'Opening Ceremony',
     'Eddy Sugiri · Mary Kennedy Thompson · Dr. Ivan Misner', 'plenary');

-- Place each class in its block, by the title the rundown itself names. Room
-- numbers deliberately play no part: the room a class is in and the session it
-- belongs to are different numbers, and matching on the title is what the
-- committee's own artwork says.
UPDATE seminars s
SET rundown_id = b.id,
    slot = CASE b.title WHEN 'Learning Session 1' THEN 1 ELSE 2 END
FROM rundown b
WHERE b.kind = 'learning'
  AND b.starts_at::date = DATE '2026-09-03'
  AND (
      (b.title = 'Learning Session 1' AND s.title IN (
          'Your Face Tells a Story',
          'Work-Life Balance & AI: The New Agency Equation'))
   OR (b.title = 'Learning Session 2' AND s.title IN (
          'Navigating the Mid-Market HR Squeeze: Talent, AI, and Wellbeing in 2026',
          'How to Win in Retail: The 2026 Economic Reality'))
  );
