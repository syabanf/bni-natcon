package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadDotEnv(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, ".env")
	content := "# komentar\n" +
		"FOO_TEST_KEY=nilai\n" +
		"QUOTED_TEST_KEY=\"dengan spasi\"\n" +
		"OVERRIDE_TEST_KEY=dari-file\n" +
		"baris tanpa sama dengan\n"
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}

	t.Setenv("OVERRIDE_TEST_KEY", "dari-env")
	os.Unsetenv("FOO_TEST_KEY")
	os.Unsetenv("QUOTED_TEST_KEY")
	t.Cleanup(func() {
		os.Unsetenv("FOO_TEST_KEY")
		os.Unsetenv("QUOTED_TEST_KEY")
	})

	loadDotEnv(path)

	if got := os.Getenv("FOO_TEST_KEY"); got != "nilai" {
		t.Errorf("FOO_TEST_KEY = %q, want %q", got, "nilai")
	}
	if got := os.Getenv("QUOTED_TEST_KEY"); got != "dengan spasi" {
		t.Errorf("QUOTED_TEST_KEY = %q, want %q", got, "dengan spasi")
	}
	if got := os.Getenv("OVERRIDE_TEST_KEY"); got != "dari-env" {
		t.Errorf("env asli harus menang: OVERRIDE_TEST_KEY = %q", got)
	}

	// File hilang tidak boleh panic.
	loadDotEnv(filepath.Join(dir, "tidak-ada.env"))
}
