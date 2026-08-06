-- Load the four real breakout classes into a database that was already seeded
-- with the old placeholder sessions. The startup seeder only fills an EMPTY
-- database, so an existing deployment needs this once:
--
--   psql "$DATABASE_URL" -f scripts/real_breakout_classes.sql
--
-- Existing registrations for the placeholder sessions are deleted along with
-- them (ON DELETE CASCADE); run this before attendees start picking classes.

BEGIN;

DELETE FROM seminars
WHERE title IN (
    'Scaling Referral: From Chapter to Nationwide',
    'AI for SMEs: Practical, Not Hype'
);

-- All four share slot 1: they run in parallel, so an attendee picks exactly
-- one and that pick is what the goodiebag is claimed against.
INSERT INTO seminars (slot, room, title, speaker, moderator, capacity, description, cover_url)
VALUES
    (1, 'Breakout Room 1',
     'Navigating the Mid-Market HR Squeeze: Talent, AI, and Wellbeing in 2026',
     'Flavia N. Sungkit, M.Psi., Psikolog — HR Consultant, Ikigai',
     'Roby Oktober', 60,
     'Mid-sized companies have outgrown startup-style HR but lack enterprise budgets. A strategic roadmap for 2026: pivoting to skills-based management against high-potential turnover, setting boundaries for agentic AI in HR, treating burnout as a boardroom hazard through workflow redesign, and handling the compliance minefield without an internal legal team.',
     ''),
    (1, 'Breakout Room 2',
     'Work-Life Balance & AI: The New Agency Equation',
     'Viktor Iwan; Irfan Arsandi — WIT Indonesia',
     'Ryan Kristomulyono', 60,
     'AI is already in the stack — the question is how it changes the way we measure work. Moving from hours logged to outcome-based performance, the expansion of human agency as AI takes over execution, why 86% of advanced users treat AI output as a starting point, and using AI as a shield for work-life balance rather than a demand for 24/7 productivity.',
     ''),
    (1, 'Breakout Room 3',
     'How to Win in Retail: The 2026 Economic Reality',
     'Ben Wirawan — Torch; Selina Nicole — LEKA',
     'David Gan', 60,
     'Indonesian shoppers are fatigued by rising costs yet still crave premium experiences. Reading the economic trade-down and value hunting, why retail is a business of feelings when 58% of consumers report daily stress, the continued reign of the physical store, and preparing product data for the rise of agentic commerce.',
     ''),
    (1, 'Breakout Room 4',
     'Your Face Tells a Story',
     'Suntoro Suciatmaja',
     '', 60,
     'Reading faces as a practical business skill — what expression, structure, and first impressions communicate before a word is said, and how to use that in sales conversations, negotiation, and building trust fast.',
     '');

COMMIT;
