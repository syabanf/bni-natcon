-- Learning Session 1 runs 08.00–09.00, not to 10.00 — the committee's
-- correction of 31 Aug 2026. Session 2 already reads 10.00–11.00. The class
-- cards and the landing page's session details print a block's hours, so
-- this is where the fix belongs; the clash rule still sees two blocks that
-- never overlap.

UPDATE rundown
SET ends_at = '2026-09-03 09:00:00+07'
WHERE title = 'Learning Session 1'
  AND starts_at = '2026-09-03 08:00:00+07'
  AND ends_at = '2026-09-03 10:00:00+07';
