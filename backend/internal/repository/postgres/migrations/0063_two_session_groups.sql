-- Learning Sessions come in two GROUPS, not four rooms: "Learning Session 1"
-- is the 08.00-09.00 pair, "Learning Session 2" the 10.00-11.00 pair — the
-- committee's correction of 31 Aug 2026. The room label now names the group,
-- so both classes in an hour carry the same badge and nothing on a card
-- contradicts its hours. Idempotent, and a fresh database gets this straight
-- from the seed.

UPDATE seminars
SET room = 'Learning Session ' || slot::text
WHERE room ~ '^Learning Session [1-4]$'
  AND room <> 'Learning Session ' || slot::text;
