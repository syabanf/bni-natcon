package http

import "testing"

// The point of these messages is that whoever picked the file learns what to
// do next, so each case is checked for the word that carries that.
func TestUnsupportedImageMessage(t *testing.T) {
	heic := make([]byte, 16)
	copy(heic[4:], "ftypheic")

	cases := []struct {
		name    string
		head    []byte
		sniffed string
		want    string
	}{
		{"iPhone HEIC", heic, "application/octet-stream", "HEIC"},
		{"a PDF", []byte("%PDF-1.7\n"), "application/pdf", "PDF"},
		{"a spreadsheet", []byte("PK\x03\x04"), "application/zip", "document"},
		{"a video", []byte("\x00\x00\x00\x18ftypmp42"), "video/mp4", "video"},
		{"something else entirely", []byte("\x7fELF"), "application/octet-stream", "not an image"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := unsupportedImageMessage(c.head, c.sniffed)
			if !contains(got, c.want) {
				t.Errorf("message for %s = %q, want it to mention %q", c.name, got, c.want)
			}
			// Every message has to end with the way out, not just the refusal.
			if !contains(got, "JPG, PNG, WEBP or GIF") {
				t.Errorf("message for %s does not say what is accepted: %q", c.name, got)
			}
		})
	}
}

func TestIsHEICIgnoresOtherISOMedia(t *testing.T) {
	mp4 := []byte("\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00")
	if isHEIC(mp4) {
		t.Error("an mp4 must not be reported as HEIC")
	}
	short := []byte("ftyp")
	if isHEIC(short) {
		t.Error("a truncated header must not panic or match")
	}
}

func TestHumanBytesReadsLikeAPerson(t *testing.T) {
	for _, c := range []struct {
		in   int64
		want string
	}{
		{2 << 20, "2 MB"},
		{6 << 20, "6 MB"},
		{int64(2.5 * (1 << 20)), "2.5 MB"},
		{512 << 10, "512 KB"},
	} {
		if got := humanBytes(c.in); got != c.want {
			t.Errorf("humanBytes(%d) = %q, want %q", c.in, got, c.want)
		}
	}
}

func contains(haystack, needle string) bool {
	return len(needle) == 0 || (len(haystack) >= len(needle) &&
		func() bool {
			for i := 0; i+len(needle) <= len(haystack); i++ {
				if haystack[i:i+len(needle)] == needle {
					return true
				}
			}
			return false
		}())
}
