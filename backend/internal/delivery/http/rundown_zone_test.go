package http

import (
	"testing"
	"time"

	"natcon2026/backend/internal/domain"
)

// The committee types 13:00 and every attendee has to read 13:00, whatever
// zone the server happens to run in. Containers run on UTC by default, so
// this is the normal case, not an edge case.
func TestRundownIsSentInJakartaHours(t *testing.T) {
	jakarta := time.FixedZone("WIB", 7*60*60)
	start := time.Date(2026, 9, 3, 13, 0, 0, 0, jakarta)

	block := domain.RundownBlock{
		StartsAt: start.UTC(), // what Postgres hands back on a UTC server
		EndsAt:   start.Add(2 * time.Hour).UTC(),
		Title:    "Learning Class",
	}

	dto := rundownDTO(block)
	if got := dto["starts_at"]; got != "2026-09-03T13:00:00+07:00" {
		t.Errorf("starts_at = %v, want 13:00 +07:00 — the attendee agenda shows these characters", got)
	}
	if got := dto["ends_at"]; got != "2026-09-03T15:00:00+07:00" {
		t.Errorf("ends_at = %v, want 15:00 +07:00", got)
	}
}
