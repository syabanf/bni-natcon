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
	jwt        *JWTIssuer
	auth       *usecase.AuthUsecase
	member     *usecase.MemberUsecase
	scan       *usecase.ScanUsecase
	seminar    *usecase.SeminarUsecase
	booth      *usecase.BoothUsecase
	admin      *usecase.AdminUsecase
	networking *usecase.NetworkingUsecase
}

func NewServer(
	jwt *JWTIssuer,
	auth *usecase.AuthUsecase,
	member *usecase.MemberUsecase,
	scan *usecase.ScanUsecase,
	seminar *usecase.SeminarUsecase,
	booth *usecase.BoothUsecase,
	admin *usecase.AdminUsecase,
	networking *usecase.NetworkingUsecase,
) *Server {
	return &Server{
		jwt: jwt, auth: auth, member: member, scan: scan,
		seminar: seminar, booth: booth, admin: admin, networking: networking,
	}
}

func (s *Server) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: []string{
			"http://localhost:5173", "http://127.0.0.1:5173",
			"http://localhost:5174", "http://127.0.0.1:5174",
		},
		AllowedMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
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
				r.Delete("/seminars/{id}/register", s.handleUnregisterSeminar)
				r.Get("/networking", s.handleNetworkingStatus)
				r.Post("/networking/checkin", s.handleNetworkingCheckIn)
				r.Post("/networking/contacts", s.handleNetworkingSaveContact)
				r.Post("/networking/contacts/all", s.handleNetworkingSaveAll)
			})

			r.Group(func(r chi.Router) {
				r.Use(requireRole(domain.RoleTenant))
				r.Post("/scans", s.handleScan)
				r.Get("/booth", s.handleBooth)
				r.Get("/booth/stats", s.handleBoothStats)
				r.Get("/booth/visitors", s.handleBoothVisitors)
			})

			r.Group(func(r chi.Router) {
				r.Use(requireRole(domain.RoleAdmin))
				r.Get("/admin/overview", s.handleAdminOverview)
				r.Get("/admin/tenants", s.handleAdminTenants)
				r.Get("/admin/seminars", s.handleAdminSeminars)
				r.Get("/admin/activity", s.handleAdminActivity)

				r.Get("/admin/members", s.handleAdminListMembers)
				r.Get("/admin/members/{id}", s.handleAdminMemberDetail)
				r.Get("/admin/tenants/{id}", s.handleAdminTenantDetail)
				r.Get("/admin/seminars/{id}", s.handleAdminSeminarDetail)
				r.Post("/admin/members", s.handleAdminCreateMember)
				r.Put("/admin/members/{id}", s.handleAdminUpdateMember)
				r.Delete("/admin/members/{id}", s.handleAdminDeleteMember)

				r.Post("/admin/tenants", s.handleAdminCreateTenant)
				r.Put("/admin/tenants/{id}", s.handleAdminUpdateTenant)
				r.Delete("/admin/tenants/{id}", s.handleAdminDeleteTenant)

				r.Post("/admin/seminars", s.handleAdminCreateSeminar)
				r.Put("/admin/seminars/{id}", s.handleAdminUpdateSeminar)
				r.Delete("/admin/seminars/{id}", s.handleAdminDeleteSeminar)

				r.Post("/admin/members/bulk", s.handleAdminBulkMembers)
				r.Post("/admin/tenants/bulk", s.handleAdminBulkTenants)
				r.Get("/admin/report/visits", s.handleAdminVisitReport)
				r.Get("/admin/report/registrations", s.handleAdminRegistrationReport)
			})
		})
	})

	return r
}
