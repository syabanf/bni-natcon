-- Speakers and moderators as rows, so each one can carry a photo and a title.
-- seminars.speaker / seminars.moderator stay as the plain-text summary used by
-- reports and the admin table; this table is what the class card renders.
CREATE TABLE seminar_speakers (
    id         BIGSERIAL PRIMARY KEY,
    seminar_id BIGINT NOT NULL REFERENCES seminars (id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    role       TEXT NOT NULL DEFAULT 'speaker' CHECK (role IN ('speaker', 'moderator')),
    title      TEXT NOT NULL DEFAULT '',
    photo_url  TEXT NOT NULL DEFAULT '',
    sort       INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_seminar_speakers_seminar ON seminar_speakers (seminar_id, sort, id);
