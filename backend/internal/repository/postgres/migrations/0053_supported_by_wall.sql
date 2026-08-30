-- The "Supported by" wall, as one piece of artwork.
--
-- The committee sent it the way it will be printed: a single composite of
-- every supporter's logo ("SUPPORTED BY_ALL LOGO.png"). It stays one image on
-- purpose — slicing sixty-odd marks out of a picture invents sixty edits
-- nobody proofread, and the committee already arranged them the way they
-- want them read.
--
-- One row carries it. The home screen keeps Diamond and Platinum on the
-- wall; this row is what makes the "More partners" button appear, and the
-- sheet behind it shows the composite full-width.

INSERT INTO sponsors (tier, name, logo_url, sort)
SELECT 'supported', 'Supported by', '/sponsors/supported-by-all.png', 100
WHERE NOT EXISTS (SELECT 1 FROM sponsors WHERE tier = 'supported');
