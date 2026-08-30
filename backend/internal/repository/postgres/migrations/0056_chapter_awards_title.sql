-- The awards block reads as one headline, not a title with a footnote:
-- the committee wants "Chapter Awards" and "Director & Ambassador Awards"
-- both in bold, so both belong in the title. The separator matches the
-- " · " the agenda already uses between lines.

UPDATE rundown
SET title = 'Chapter Awards · Director & Ambassador Awards', place = ''
WHERE title = 'Chapter Awards';
