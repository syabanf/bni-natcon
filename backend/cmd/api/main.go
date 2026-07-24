package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"time"

	"natcon2026/backend/internal/config"
	httpdelivery "natcon2026/backend/internal/delivery/http"
	"natcon2026/backend/internal/repository/postgres"
	"natcon2026/backend/internal/usecase"
)

func main() {
	cfg := config.Load()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := postgres.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("database connection failed", "err", err)
		os.Exit(1)
	}
	defer pool.Close()

	if err := postgres.Migrate(ctx, pool); err != nil {
		slog.Error("migration failed", "err", err)
		os.Exit(1)
	}
	if err := postgres.SeedIfEmpty(ctx, pool, cfg.SeedPassword); err != nil {
		slog.Error("seed failed", "err", err)
		os.Exit(1)
	}

	userRepo := postgres.NewUserRepo(pool)
	tenantRepo := postgres.NewTenantRepo(pool)
	visitRepo := postgres.NewVisitRepo(pool)
	seminarRepo := postgres.NewSeminarRepo(pool)

	jwtIssuer := httpdelivery.NewJWTIssuer(cfg.JWTSecret, cfg.JWTTTL)

	server := httpdelivery.NewServer(
		jwtIssuer,
		usecase.NewAuthUsecase(userRepo, jwtIssuer, httpdelivery.BcryptVerifier{}),
		usecase.NewMemberUsecase(userRepo, tenantRepo, visitRepo, seminarRepo),
		usecase.NewScanUsecase(userRepo, tenantRepo, visitRepo),
		usecase.NewSeminarUsecase(seminarRepo),
		usecase.NewBoothUsecase(tenantRepo, visitRepo),
		usecase.NewAdminUsecase(postgres.NewAdminRepo(pool), httpdelivery.BcryptVerifier{}, cfg.SeedPassword),
		usecase.NewNetworkingUsecase(postgres.NewNetworkingRepo(pool)),
	)

	slog.Info("API listening", "addr", cfg.Addr)
	if err := http.ListenAndServe(cfg.Addr, server.Router()); err != nil {
		slog.Error("server stopped", "err", err)
		os.Exit(1)
	}
}
