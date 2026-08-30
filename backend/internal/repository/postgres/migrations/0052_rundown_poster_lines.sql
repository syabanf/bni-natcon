-- The sub-agenda lines, exactly as the rundown artwork prints them.
--
-- 0048 laid out the sixteen blocks but abbreviated what runs inside them:
-- the learning talks lost their speakers, and the Opening Ceremony lost the
-- "Welcome Address" / "Special Message" labels and the three roles printed
-- under the names. The home agenda renders `place` one line per " · "-joined
-- item, so carrying the artwork's lines verbatim here puts each one where
-- the poster puts it.
--
-- Titles are copied letter for letter — "Your Face Tell a Story" and the
-- space before the keynote's colon included — because the artwork is the
-- committee's published wording, not ours to correct.

UPDATE rundown SET place = ''
WHERE title = 'Registration & Open Networking';

UPDATE rundown SET place = 'Your Face Tell a Story - Suntoro Suciatmaja · Work-Life Balance AI - Viktor Iwan & Irfan Arsandi'
WHERE title = 'Learning Session 1';

UPDATE rundown SET place = 'Navigating the Mid-Market HR Squeeze - Flavia Norpina Sungkit · How to Win in Retail - Ben Wirawan & Selina Nicole'
WHERE title = 'Learning Session 2';

UPDATE rundown SET place = 'Welcome Address - Eddy Sugiri · BNI Indonesia National Director · Special Message - Dr. Ivan Misner · Founder and Chief Visionary Officer of BNI · Special Message - Mary Kennedy Thompson · CEO of BNI'
WHERE title = 'Opening Ceremony';

UPDATE rundown SET title = 'Keynote Speaker Session : Phil Berg'
WHERE title = 'Keynote Speaker Session: Phil Berg';
