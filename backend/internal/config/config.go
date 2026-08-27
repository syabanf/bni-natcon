package config

import (
	"bufio"
	"os"
	"strconv"
	"strings"
	"time"
)

// DefaultJWTSecret is only acceptable outside production; main refuses to
// start in production with this value.
const DefaultJWTSecret = "dev-secret-change-me"

type Config struct {
	Addr           string
	DatabaseURL    string
	JWTSecret      string
	JWTTTL         time.Duration
	SeedPassword   string
	Env            string
	AllowedOrigins []string
	UploadDir      string
	DBMaxConns     int32
	DBMinConns     int32
}

// loadDotEnv reads KEY=VALUE pairs from the given file into the process
// environment. Real environment variables always win; missing file is fine.
func loadDotEnv(path string) {
	f, err := os.Open(path)
	if err != nil {
		return
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		value = strings.TrimSpace(value)
		value = strings.Trim(value, `"'`)
		if key == "" || os.Getenv(key) != "" {
			continue
		}
		os.Setenv(key, value)
	}
}

func Load() Config {
	// `.env` di working directory (repo root saat `go run ./backend/cmd/api`)
	// atau di folder backend saat dijalankan dari sana.
	loadDotEnv(".env")
	loadDotEnv("../.env")
	// The Android APK is a WebView served from https://localhost (Capacitor's
	// androidScheme), so that origin has to be allowed or every call from the
	// installed app fails CORS. Production must keep it in ALLOWED_ORIGINS
	// too — see docs/ANDROID.md.
	origins := strings.Split(getenv("ALLOWED_ORIGINS",
		"http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,https://localhost"), ",")
	for i := range origins {
		origins[i] = strings.TrimSpace(origins[i])
	}
	return Config{
		Addr:           getenv("ADDR", ":8080"),
		DatabaseURL:    getenv("DATABASE_URL", "postgres://natcon:natcon@localhost:5432/natcon?sslmode=disable"),
		JWTSecret:      getenv("JWT_SECRET", DefaultJWTSecret),
		JWTTTL:         12 * time.Hour,
		SeedPassword:   getenv("SEED_PASSWORD", "natcon2026"),
		Env:            getenv("APP_ENV", "development"),
		AllowedOrigins: origins,
		UploadDir:      getenv("UPLOAD_DIR", "uploads"),
		// Per instance — see postgres.NewPool. Behind a load balancer the
		// budget is replicas x DB_MAX_CONNS, and it has to stay under the
		// database's own max_connections.
		DBMaxConns: int32(getenvInt("DB_MAX_CONNS", 10)),
		DBMinConns: int32(getenvInt("DB_MIN_CONNS", 2)),
	}
}

func (c Config) IsProduction() bool {
	return strings.EqualFold(c.Env, "production")
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// getenvInt reads a positive integer; anything unparseable or <= 0 falls back
// rather than silently disabling a limiter.
func getenvInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(strings.TrimSpace(v))
	if err != nil || n <= 0 {
		return fallback
	}
	return n
}
