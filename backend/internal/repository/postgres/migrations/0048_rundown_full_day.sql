-- The committee's run of show, in full: Event Rundown_BNI ID National
-- Conference 2026.pdf, 3 September at the Pullman.
--
-- This replaces every rundown migration before it. 0024 guessed a day from
-- the ticket window; 0025 invented a Gold Club breakfast for the morning
-- after; 0041 had only the half of the artwork that fitted in a screenshot
-- and stopped at the Opening Ceremony. The day actually runs to 18.30.
--
-- END TIMES: the artwork gives start times only, so each block runs until the
-- next one begins — which is what a rundown means. Closing is the exception,
-- with nothing after it to bound it; 19.00 is half an hour, and the Rundown
-- page is where the committee corrects that without a redeploy.
--
-- The two learning blocks overlap the Chapter Photo Session and Coffee Break
-- 1 exactly as the artwork does. That is the committee's schedule, not a
-- mistake to tidy up on their behalf.

DELETE FROM rundown;

INSERT INTO rundown (starts_at, ends_at, title, place, kind) VALUES
    ('2026-09-03 07:00:00+07', '2026-09-03 08:00:00+07',
     'Registration & Open Networking', 'Main Lobby', 'registration'),
    ('2026-09-03 08:00:00+07', '2026-09-03 08:30:00+07',
     'Chapter Photo Session', '', 'plenary'),
    -- Two classes run in parallel inside each learning block; an attendee
    -- takes one from each and leaves with two.
    ('2026-09-03 08:00:00+07', '2026-09-03 10:00:00+07',
     'Learning Session 1',
     'Your Face Tell a Story · Work-Life Balance AI', 'learning'),
    ('2026-09-03 08:30:00+07', '2026-09-03 10:00:00+07',
     'Coffee Break 1', '', 'break'),
    ('2026-09-03 10:00:00+07', '2026-09-03 11:00:00+07',
     'Learning Session 2',
     'Navigating the Mid-Market HR Squeeze · How to Win in Retail', 'learning'),
    ('2026-09-03 11:00:00+07', '2026-09-03 12:15:00+07',
     'Lunch Break', '', 'break'),
    ('2026-09-03 12:15:00+07', '2026-09-03 14:00:00+07',
     'Opening Ceremony',
     'Eddy Sugiri · Dr. Ivan Misner · Mary Kennedy Thompson', 'plenary'),
    ('2026-09-03 14:00:00+07', '2026-09-03 15:15:00+07',
     'Keynote Speaker Session: Phil Berg', '', 'plenary'),
    ('2026-09-03 15:15:00+07', '2026-09-03 15:30:00+07',
     'Coffee Break 2', '', 'break'),
    ('2026-09-03 15:30:00+07', '2026-09-03 16:10:00+07',
     'Speed Networking Session 1', 'Your Dream Referral', 'networking'),
    ('2026-09-03 16:10:00+07', '2026-09-03 16:50:00+07',
     'Chapter Awards', 'Director & Ambassador Awards', 'plenary'),
    ('2026-09-03 16:50:00+07', '2026-09-03 17:00:00+07',
     'Door Prize 1', '', 'doorprize'),
    ('2026-09-03 17:00:00+07', '2026-09-03 17:35:00+07',
     'Speed Networking Session 2', 'Your Dream Referral', 'networking'),
    ('2026-09-03 17:35:00+07', '2026-09-03 18:20:00+07',
     'Referral Partner Awards', '', 'plenary'),
    ('2026-09-03 18:20:00+07', '2026-09-03 18:30:00+07',
     'Door Prize 2', '', 'doorprize'),
    ('2026-09-03 18:30:00+07', '2026-09-03 19:00:00+07',
     'Closing', '', 'plenary');

-- Place each class in its block. The clash rule reads a block's HOURS, so
-- this is what makes "two classes, as long as they do not overlap" work —
-- without it all four sit outside the schedule and the first pick locks the
-- other three.
UPDATE seminars s
SET rundown_id = b.id,
    slot = CASE b.title WHEN 'Learning Session 1' THEN 1 ELSE 2 END
FROM rundown b
WHERE b.kind = 'learning'
  AND (
      (b.title = 'Learning Session 1' AND s.title IN (
          'Your Face Tells a Story',
          'Work-Life Balance & AI: The New Agency Equation'))
   OR (b.title = 'Learning Session 2' AND s.title IN (
          'Navigating the Mid-Market HR Squeeze: Talent, AI, and Wellbeing in 2026',
          'How to Win in Retail: The 2026 Economic Reality'))
  );
