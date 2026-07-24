package http

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"natcon2026/backend/internal/domain"
	"natcon2026/backend/internal/usecase"
)

type Server struct {
	jwt     *JWTIssuer
	auth    *usecase.AuthUsecase
	member  *usecase.MemberUsecase
	scan    *usecase.ScanUsecase
	seminar *usecase.SeminarUsecase
	booth   *usecase.BoothUsecase
}

func NewServer(
	jwt *JWTIssuer,
	auth *usecase.AuthUsecase,
	member *usecase.MemberUsecase,
	scan *usecase.ScanUsecase,
	seminar *usecase.SeminarUsecase,
	booth *usecase.BoothUsecase,
) *Server {
	return &Server{jwt: jwt, auth: auth, member: member, scan: scan, seminar: seminar, booth: booth}
}

func (s *Server) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: []string{"http://localhost:5173", "http://127.0.0.1:5173"},
		AllowedMethods: []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders: []string{"Authorization", "Content-Type"},
	}))

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	r.Route("/api/v1", func(r chi.Router) {
		r.Post("/auth/login", s.handleLogin)

		r.Group(func(r chi.Router) {
			r.Use(s.authMiddleware)
			r.Get("/me", s.handleMe)

			r.Group(func(r chi.Router) {
				r.Use(requireRole(domain.RoleMember))
				r.Get("/tenants", s.handleListTenants)
				r.Get("/seminars", s.handleListSeminars)
				r.Post("/seminars/{id}/register", s.handleRegisterSeminar)
			})

			r.Group(func(r chi.Router) {
				r.Use(requireRole(domain.RoleTenant))
				r.Post("/scans", s.handleScan)
				r.Get("/booth", s.handleBooth)
				r.Get("/booth/stats", s.handleBoothStats)
				r.Get("/booth/visitors", s.handleBoothVisitors)
			})
		})
	})

	return r
}
