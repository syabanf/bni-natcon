package config

import (
	"os"
	"time"
)

type Config struct {
	Addr         string
	DatabaseURL  string
	JWTSecret    string
	JWTTTL       time.Duration
	SeedPassword string
}

func Load() Config {
	return Config{
		Addr:         getenv("ADDR", ":8080"),
		DatabaseURL:  getenv("DATABASE_URL", "postgres://natcon:natcon@localhost:5432/natcon?sslmode=disable"),
		JWTSecret:    getenv("JWT_SECRET", "dev-secret-change-me"),
		JWTTTL:       12 * time.Hour,
		SeedPassword: getenv("SEED_PASSWORD", "natcon2026"),
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
