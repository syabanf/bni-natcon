-- Attendees agree, in the app, that using it means handing the committee
-- their name and email.
--
-- The consent has to be recorded per person and per moment, not assumed: a
-- ticket import is the committee writing somebody's details down, which is
-- not the same as that person agreeing to it. So the timestamp lives on the
-- account, empty until they tick the box on first sign-in, and the app will
-- not go past that screen while it is empty.
--
-- Nullable on purpose. NULL means "has not agreed yet" — an attendee seeded
-- before this migration is asked the next time they sign in, and nobody is
-- silently marked as having consented to something they never saw.

ALTER TABLE users ADD COLUMN IF NOT EXISTS consented_at timestamptz;
