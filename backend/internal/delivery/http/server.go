package http

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/go-chi/httprate"

	"natcon2026/backend/internal/domain"
	"natcon2026/backend/internal/usecase"
)

// maxBodyBytes caps request bodies; bulk imports are the largest payloads
// and stay well under this.
const maxBodyBytes = 2 << 20 // 2 MiB

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "no-referrer")
		h.Set("Cache-Control", "no-store")
		next.ServeHTTP(w, r)
	})
}

func limitBody(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
		next.ServeHTTP(w, r)
	})
}

type Server struct {
	jwt            *JWTIssuer
	auth           *usecase.AuthUsecase
	member         *usecase.MemberUsecase
	scan           *usecase.ScanUsecase
	seminar        *usecase.SeminarUsecase
	booth          *usecase.BoothUsecase
	admin          *usecase.AdminUsecase
	networking     *usecase.NetworkingUsecase
	allowedOrigins []string
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
	allowedOrigins []string,
) *Server {
	return &Server{
		jwt: jwt, auth: auth, member: member, scan: scan,
		seminar: seminar, booth: booth, admin: admin, networking: networking,
		allowedOrigins: allowedOrigins,
	}
}

func (s *Server) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))
	r.Use(metricsMiddleware)
	r.Use(securityHeaders)
	r.Use(limitBody)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: s.allowedOrigins,
		AllowedMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{"Authorization", "Content-Type"},
	}))

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	r.Handle("/metrics", metricsHandler())

	r.Route("/api/v1", func(r chi.Router) {
		// Brute-force protection: 10 login attempts per IP per minute.
		r.With(httprate.LimitByIP(10, time.Minute)).Post("/auth/login", s.handleLogin)

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
				r.Get("/networking/history", s.handleNetworkingHistory)
				r.Get("/networking/tables/{id}", s.handleNetworkingTableDetail)
				r.Get("/networking/contacts/{id}", s.handleNetworkingContactDetail)
				r.Post("/networking/checkin", s.handleNetworkingCheckIn)
				r.Post("/networking/contacts", s.handleNetworkingSaveContact)
				r.Post("/networking/contacts/all", s.handleNetworkingSaveAll)
				r.Put("/networking/contacts/{id}/note", s.handleNetworkingContactNote)
			})

			r.Group(func(r chi.Router) {
				r.Use(requireRole(domain.RoleTenant))
				r.Post("/scans", s.handleScan)
				r.Get("/booth", s.handleBooth)
				r.Get("/booth/stats", s.handleBoothStats)
				r.Get("/booth/visitors", s.handleBoothVisitors)
				r.Get("/booth/visitors/{memberID}", s.handleVisitorDetail)
				r.Put("/booth/visitors/{memberID}/note", s.handleVisitorNote)
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

				r.Post("/admin/seminars/{id}/checkin", s.handleAdminSeminarCheckin)
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
