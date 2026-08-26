package domain

import "testing"

// The derived first password is what gets printed on the committee's
// briefing sheet, so the rule has to survive real company names — dots,
// ampersands, double stands and all.
func TestTenantDefaultPassword(t *testing.T) {
	cases := []struct{ name, booth, want string }{
		{"WIT.id", "A14", "witida14"},
		{"SSCX International", "A1", "sscxinternationala1"},
		{"PT. ORIENTAL LOGISTICS INDONESIA", "A2", "ptorientallogisticsindonesiaa2"},
		{"Alpha leaders", "A47 & A48", "alphaleadersa47a48"},
		{"Paper.id", "A20", "paperida20"},
	}
	for _, c := range cases {
		if got := TenantDefaultPassword(c.name, c.booth); got != c.want {
			t.Errorf("TenantDefaultPassword(%q, %q) = %q, want %q", c.name, c.booth, got, c.want)
		}
	}
}
