-- Load the four real learning classes (and their speakers) into a database
-- that was already seeded with the old placeholder sessions. The startup
-- seeder only fills an EMPTY database, so an existing deployment needs this:
--
--   psql "$DATABASE_URL" -f scripts/real_breakout_classes.sql
--
-- Safe to re-run: classes are matched by room and only inserted when missing,
-- so existing registrations survive. Speaker rows are always replaced, which
-- is how you push updated photos or titles.

BEGIN;

-- The two placeholder sessions from the original mockup, if still present.
DELETE FROM seminars
WHERE title IN (
    'Scaling Referral: From Chapter to Nationwide',
    'AI for SMEs: Practical, Not Hype'
);

-- All four share slot 1: they run in parallel, so an attendee picks exactly
-- one and that pick is what the goodiebag is claimed against.
INSERT INTO seminars (slot, room, title, speaker, moderator, capacity, description, cover_url)
SELECT v.slot, v.room, v.title, v.speaker, v.moderator, v.capacity, v.description,
       '/covers/' || lower(replace(v.room, ' ', '-')) || '.jpg'
FROM (VALUES
    (1, 'Learning Class 1',
     'Navigating the Mid-Market HR Squeeze: Talent, AI, and Wellbeing in 2026',
     'Flavia N. Sungkit, M.Psi., Psikolog — HR Consultant, Ikigai',
     'Roby Oktober', 60,
     'Mid-sized companies have outgrown startup-style HR but lack enterprise budgets. A strategic roadmap for 2026: pivoting to skills-based management against high-potential turnover, setting boundaries for agentic AI in HR, treating burnout as a boardroom hazard through workflow redesign, and handling the compliance minefield without an internal legal team.'),
    (1, 'Learning Class 2',
     'Work-Life Balance & AI: The New Agency Equation',
     'Viktor Iwan; Irfan Arsandi — WIT Indonesia',
     'Ryan Kristomulyono', 60,
     'AI is already in the stack — the question is how it changes the way we measure work. Moving from hours logged to outcome-based performance, the expansion of human agency as AI takes over execution, why 86% of advanced users treat AI output as a starting point, and using AI as a shield for work-life balance rather than a demand for 24/7 productivity.'),
    (1, 'Learning Class 3',
     'How to Win in Retail: The 2026 Economic Reality',
     'Ben Wirawan — Torch; Selina Nicole — LEKA',
     'David Gan', 60,
     'Indonesian shoppers are fatigued by rising costs yet still crave premium experiences. Reading the economic trade-down and value hunting, why retail is a business of feelings when 58% of consumers report daily stress, the continued reign of the physical store, and preparing product data for the rise of agentic commerce.'),
    (1, 'Learning Class 4',
     'Your Face Tells a Story',
     'Suntoro Suciatmaja',
     '', 60,
     'Reading faces as a practical business skill — what expression, structure, and first impressions communicate before a word is said, and how to use that in sales conversations, negotiation, and building trust fast.')
) AS v (slot, room, title, speaker, moderator, capacity, description)
WHERE NOT EXISTS (SELECT 1 FROM seminars s WHERE s.room = v.room);

-- Room posters, for classes that were inserted before covers existed.
UPDATE seminars
SET cover_url = '/covers/' || lower(replace(room, ' ', '-')) || '.jpg'
WHERE room LIKE 'Learning Class %' AND cover_url = '';

-- Speakers and moderators, with the photos each app serves from public/speakers/.
DELETE FROM seminar_speakers
WHERE seminar_id IN (SELECT id FROM seminars WHERE room LIKE 'Learning Class %');

INSERT INTO seminar_speakers (seminar_id, name, role, title, photo_url, sort)
SELECT s.id, v.name, v.role, v.title, v.photo_url, v.sort
FROM (VALUES
    ('Learning Class 1', 'Flavia N. Sungkit, M.Psi., Psikolog', 'speaker',   'HR Consultant · Ikigai',                                  '/speakers/flavia-sungkit.jpg',     0),
    ('Learning Class 1', 'Roby Oktober',                        'moderator', '',                                                        '/speakers/roby-oktober.jpg',       1),
    ('Learning Class 2', 'Viktor Iwan',                         'speaker',   '',                                                        '/speakers/viktor-iwan.jpg',        0),
    ('Learning Class 2', 'Irfan Arsandi',                       'speaker',   'IT & Digital Transformation Consultant · WIT Indonesia',   '/speakers/irfan-arsandi.jpg',      1),
    ('Learning Class 2', 'Ryan Kristomulyono',                  'moderator', '',                                                        '/speakers/ryan-kristomulyono.jpg', 2),
    ('Learning Class 3', 'Ben Wirawan',                         'speaker',   'Co-Founder & CEO · Torch',                                '/speakers/ben-wirawan.jpg',        0),
    ('Learning Class 3', 'Selina Nicole',                       'speaker',   'Founder · LEKA',                                          '/speakers/selina-nicole.jpg',      1),
    ('Learning Class 3', 'David Gan',                           'moderator', 'CEO & Founder · Arkova Training & Consulting',            '/speakers/david-gan.jpg',          2),
    ('Learning Class 4', 'Suntoro Suciatmaja',                  'speaker',   '',                                                        '/speakers/suntoro-suciatmaja.jpg', 0)
) AS v (room, name, role, title, photo_url, sort)
JOIN seminars s ON s.room = v.room;

COMMIT;
