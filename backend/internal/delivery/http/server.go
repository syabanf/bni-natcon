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
		limit := int64(maxBodyBytes)
		// Image uploads get their own, larger cap (validated again in the
		// handler); everything else stays at the tight JSON limit.
		if r.URL.Path == "/api/v1/admin/uploads" {
			limit = maxUploadBytes + (1 << 20)
		}
		r.Body = http.MaxBytesReader(w, r.Body, limit)
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
	uploadDir      string
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
	uploadDir string,
) *Server {
	return &Server{
		jwt: jwt, auth: auth, member: member, scan: scan,
		seminar: seminar, booth: booth, admin: admin, networking: networking,
		allowedOrigins: allowedOrigins, uploadDir: uploadDir,
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
		AllowedMethods: []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{"Authorization", "Content-Type"},
	}))

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	r.Handle("/metrics", metricsHandler())
	r.Handle("/uploads/*", s.uploadsHandler())

	r.Route("/api/v1", func(r chi.Router) {
		// Brute-force protection: 10 login attempts per IP per minute.
		r.With(httprate.LimitByIP(10, time.Minute)).Post("/auth/login", s.handleLogin)
		// Recovery is guessable by design (chapter + phone), so it gets the
		// same brute-force ceiling as login.
		r.With(httprate.LimitByIP(10, time.Minute)).Post("/auth/login/select", s.handleSelectAccount)
		r.With(httprate.LimitByIP(10, time.Minute)).Post("/auth/forgot", s.handleForgotPassword)
		r.With(httprate.LimitByIP(10, time.Minute)).Post("/auth/reset", s.handleResetPassword)

		r.Group(func(r chi.Router) {
			r.Use(s.authMiddleware)
			r.Get("/me", s.handleMe)
			r.Post("/auth/password", s.handleSetPassword)

			// The schedule is the same for everyone in the building — the
			// attendee agenda, the booth crew wondering when networking
			// starts, the committee. No role owns it.
			r.Get("/rundown", s.handleListRundown)
			// Everyone in the hall counts down to the same moment.
			r.Get("/networking/session", s.handleNetworkingSession)

			r.Group(func(r chi.Router) {
				r.Use(requireRole(domain.RoleMember))
				r.Get("/tenants", s.handleListTenants)
				r.Get("/seminars", s.handleListSeminars)
				r.Get("/seminars/{id}/attendees", s.handleSeminarAttendees)
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
				r.Post("/admin/seminars/{id}/registrations", s.handleAdminRegisterSeminarMember)
				r.Delete("/admin/seminars/{id}/registrations/{code}", s.handleAdminUnregisterSeminarMember)
				r.Post("/admin/seminars/registrations/bulk", s.handleAdminBulkRegistrations)
				r.Post("/admin/seminars", s.handleAdminCreateSeminar)
				r.Put("/admin/seminars/{id}", s.handleAdminUpdateSeminar)
				r.Patch("/admin/seminars/{id}/quota", s.handleAdminSetSeminarQuota)
				r.Delete("/admin/seminars/{id}", s.handleAdminDeleteSeminar)

				// The desk that hands over pins and goodiebags, by scan.
				r.Post("/admin/redeem", s.handleRedeem)
				r.Get("/admin/redeem/counts", s.handleRedeemCounts)

				// The event schedule in one-hour blocks.
				r.Get("/admin/rundown", s.handleListRundown)
				r.Post("/admin/rundown", s.handleCreateRundown)
				r.Put("/admin/rundown/{id}", s.handleUpdateRundown)
				r.Delete("/admin/rundown/{id}", s.handleDeleteRundown)

				r.Get("/admin/tables", s.handleAdminListTables)
				// The two prize draws.
				r.Get("/admin/draws", s.handleDraws)
				r.Get("/admin/draws/{key}", s.handleDrawPool)
				r.Post("/admin/draws/{key}/pick", s.handleDrawPick)
				r.Put("/admin/draws/{key}/minimum", s.handleDrawMinimum)
				r.Delete("/admin/draws/{key}/winners", s.handleDrawReset)

				r.Get("/admin/tables/seats", s.handleAdminTableSeats)
				r.Post("/admin/networking/session/start", s.handleStartNetworkingSession)
				r.Post("/admin/networking/session/stop", s.handleStopNetworkingSession)
				r.Post("/admin/tables/generate", s.handleAdminGenerateTables)
				r.Put("/admin/tables/{id}", s.handleAdminUpdateTable)
				r.Delete("/admin/tables/{id}", s.handleAdminDeleteTable)

				r.Get("/admin/chapters", s.handleAdminListChapters)
				r.Post("/admin/chapters", s.handleAdminCreateChapter)
				r.Put("/admin/chapters/{id}", s.handleAdminRenameChapter)
				r.Delete("/admin/chapters/{id}", s.handleAdminDeleteChapter)

				r.Post("/admin/uploads", s.handleAdminUpload)

				r.Post("/admin/members/bulk", s.handleAdminBulkMembers)
				r.Post("/admin/tenants/bulk", s.handleAdminBulkTenants)
				r.Get("/admin/report/visits", s.handleAdminVisitReport)
				r.Get("/admin/report/registrations", s.handleAdminRegistrationReport)
			})
		})
	})

	return r
}
