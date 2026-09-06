-- The draw page can now hold a whole queue of prizes instead of one name:
-- the operator types the list before the ceremony, and the stage screen
-- shows the next prize after every winner is drawn (3 Sep 2026). Adding the
-- column touches no existing row — both draws start with an empty queue,
-- and the single-name column from 0068 keeps whatever it already holds.

ALTER TABLE draws ADD COLUMN prize_list text[] NOT NULL DEFAULT '{}';
