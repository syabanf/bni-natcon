package domain

import "testing"

// The login address a booth is told to use. A double stand answers to its
// first code, matching the logins the seed migration already wrote.
func TestTenantLoginEmail(t *testing.T) {
	cases := []struct{ booth, want string }{
		{"A14", "booth-a14@natcon.id"},
		{"A1", "booth-a1@natcon.id"},
		{"Z-01", "booth-z01@natcon.id"},
		{"SP-99", "booth-sp99@natcon.id"},
		{"A47 & A48", "booth-a47@natcon.id"},
		{"a20", "booth-a20@natcon.id"},
	}
	for _, c := range cases {
		if got := TenantLoginEmail(c.booth); got != c.want {
			t.Errorf("TenantLoginEmail(%q) = %q, want %q", c.booth, got, c.want)
		}
	}
}
