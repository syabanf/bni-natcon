-- The keynote reads like every other block now: the session name in bold,
-- the speaker underneath. "Phil Berg" moves out of the title and into the
-- grey sub-line — the opposite trip the awards subtitle made in 0056,
-- because that is how the committee wants each of them to sit.

UPDATE rundown
SET title = 'Keynote Speaker Session', place = 'Phil Berg'
WHERE title = 'Keynote Speaker Session : Phil Berg';
