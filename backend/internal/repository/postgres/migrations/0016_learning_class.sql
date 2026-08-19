-- "Breakout Room" is now "Learning Class" (MoM 19 Aug 2026).
--
-- Only rows still carrying the seeded names are touched: a committee that has
-- since renamed a room meant that name, and this migration is not entitled to
-- overwrite it.
UPDATE seminars
SET room = replace(room, 'Breakout Room', 'Learning Class')
WHERE room LIKE 'Breakout Room%';

-- The agenda block the committee may already have written for the day.
UPDATE rundown
SET title = replace(title, 'Breakout', 'Learning'),
    place = replace(place, 'Breakout', 'Learning')
WHERE title LIKE '%Breakout%' OR place LIKE '%Breakout%';
