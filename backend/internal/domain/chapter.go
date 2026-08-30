package domain

import (
	"regexp"
	"strings"
)

// Everything in this app is BNI, so a leading "BNI " on a chapter name
// carries no information — it only splits one chapter into two spellings
// ("BNI Amplify" next to "Amplify"). Only that word goes: "BNI Chapter
// Sandi" is the chapter named "Chapter Sandi". Migration 0055 folded the
// seeded data; this keeps every later write to the same rule.
var chapterBNIPrefix = regexp.MustCompile(`(?i)^\s*BNI\s+`)

// NormalizeChapter returns the bare chapter name: trimmed, BNI prefix gone.
func NormalizeChapter(name string) string {
	return strings.TrimSpace(chapterBNIPrefix.ReplaceAllString(strings.TrimSpace(name), ""))
}
