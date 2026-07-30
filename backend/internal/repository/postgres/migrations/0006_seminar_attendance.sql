-- Kehadiran seminar: dicatat saat panitia pintu men-scan QR peserta.
CREATE TABLE seminar_attendance (
    id         BIGSERIAL PRIMARY KEY,
    seminar_id BIGINT NOT NULL REFERENCES seminars (id) ON DELETE CASCADE,
    member_id  BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (seminar_id, member_id)
);
