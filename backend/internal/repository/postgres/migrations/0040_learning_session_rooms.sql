-- The four rooms follow the committee's own wording.
--
-- Their rundown calls the two parallel blocks "Learning Session 1" and
-- "Learning Session 2", and every label in the apps now says session rather
-- than class. A room still called "Learning Class 3" would be the last place
-- reading the old word, on the one screen an attendee looks at while standing
-- outside the door.
--
-- Only the name changes. The cover art keeps its file names — /covers/
-- learning-class-N.jpg is artwork on disk, not a label anybody reads — and it
-- stays attached because it is a column on the same row, not a lookup by name.

UPDATE seminars
SET room = 'Learning Session ' || substring(room from 'Learning Class (.*)$')
WHERE room LIKE 'Learning Class %';
