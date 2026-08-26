-- Booth crews choose their own password on first sign-in, the way attendees
-- always have.
--
-- Until now a booth stayed on the password the committee handed out
-- (SEED_PASSWORD) unless somebody thought to change it — one password,
-- printed on a briefing sheet, shared by thirty-something stands. Anyone who
-- read that sheet could sign in as any booth and scan attendees at its name.
-- Now the handed-out password only opens the door once: the app refuses to
-- go further until the crew sets a password of their own.
--
-- Every tenant account is flipped, including any created before this
-- migration. A crew that genuinely already set their own password is asked
-- once more — a minute of annoyance, bought with certainty that no booth is
-- still on the shared one.

UPDATE users SET must_set_password = true WHERE role = 'tenant';
