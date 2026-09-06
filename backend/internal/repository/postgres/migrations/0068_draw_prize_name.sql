-- The draw page now lets the operator say what the ceremony is giving away,
-- and the stage screen shows it. Adding the column touches no existing row:
-- both draws start with an empty prize name, and the page shows nothing
-- until the operator types one (3 Sep 2026, day of the event).

ALTER TABLE draws ADD COLUMN prize_name text NOT NULL DEFAULT '';
