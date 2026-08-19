-- Booths show their own company logo instead of two letters (MoM 19 Aug 2026).
--
-- Empty means "no logo yet", and the passport falls back to the initials —
-- 31 booths will not all send artwork before the doors open, and a card with
-- a blank square is worse than a card with "SI".
ALTER TABLE tenants ADD COLUMN logo_url TEXT NOT NULL DEFAULT '';
