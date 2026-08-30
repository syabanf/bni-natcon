-- Chapters the committee has told us are wrong in their own export.
--
-- The attendee migration corrects these on the way through, so a rebuilt
-- database is already right; this is for the ones that are not rebuilt. Keyed
-- on the ticket number, because a ticket is one person and two attendees can
-- share a name.
--
-- The chapter is on the member pass every attendee shows at a booth, so a
-- wrong one is wrong in front of people all day.

UPDATE users
SET chapter = v.chapter
FROM (VALUES
    -- Stephanie Safitri Jusuf: the export says Amplify.
    ('16798-2556D8630', 'Prestige')
) AS v (ticket, chapter)
WHERE users.ticket_number = v.ticket
  AND users.chapter <> v.chapter;

-- The corrected chapter has to exist in the master list, or the admin panel's
-- chapter filter would not offer it.
INSERT INTO chapters (name)
SELECT DISTINCT chapter FROM users WHERE role = 'member' AND chapter <> ''
ON CONFLICT (name) DO NOTHING;
