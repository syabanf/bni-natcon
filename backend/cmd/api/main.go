package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"natcon2026/backend/internal/config"
	httpdelivery "natcon2026/backend/internal/delivery/http"
	"natcon2026/backend/internal/repository/postgres"
	"natcon2026/backend/internal/usecase"
)

func main() {
	cfg := config.Load()

	if cfg.JWTSecret == config.DefaultJWTSecret {
		if cfg.IsProduction() {
			slog.Error("refusing to start: JWT_SECRET must be set in production")
			os.Exit(1)
		}
		slog.Warn("using default JWT secret — set JWT_SECRET before deploying")
	}

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
		cfg.AllowedOrigins,
	)

	srv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           server.Router(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	shutdownCtx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	errCh := make(chan error, 1)
	go func() {
		slog.Info("API listening", "addr", cfg.Addr, "env", cfg.Env)
		errCh <- srv.ListenAndServe()
	}()

	select {
	case err := <-errCh:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("server stopped", "err", err)
			os.Exit(1)
		}
	case <-shutdownCtx.Done():
		slog.Info("shutting down gracefully")
		graceCtx, graceCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer graceCancel()
		if err := srv.Shutdown(graceCtx); err != nil {
			slog.Error("graceful shutdown failed", "err", err)
			os.Exit(1)
		}
	}
}
