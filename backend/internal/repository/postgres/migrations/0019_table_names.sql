-- Tables get names, not just numbers (MoM 19 Aug 2026).
--
-- "Table 7" tells a room of 700 people nothing; "Table 7 · Startup Corner"
-- is something you can shout across a ballroom. Empty means the number
-- stands on its own, which is what every table starts as.
ALTER TABLE networking_tables ADD COLUMN name TEXT NOT NULL DEFAULT '';
