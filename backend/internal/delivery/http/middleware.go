package http

import (
	"context"
	"net/http"
	"strings"

	"natcon2026/backend/internal/domain"
)

type ctxKey string

const (
	ctxUserID ctxKey = "userID"
	ctxRole   ctxKey = "role"
)

func userIDFrom(ctx context.Context) int64 {
	id, _ := ctx.Value(ctxUserID).(int64)
	return id
}

func roleFrom(ctx context.Context) domain.Role {
	role, _ := ctx.Value(ctxRole).(domain.Role)
	return role
}

func (s *Server) authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		header := r.Header.Get("Authorization")
		token, ok := strings.CutPrefix(header, "Bearer ")
		if !ok || token == "" {
			respondError(w, http.StatusUnauthorized, "you are not signed in — please log in first")
			return
		}
		userID, role, err := s.jwt.Parse(token)
		if err != nil {
			respondError(w, http.StatusUnauthorized, "your session has expired — please log in again")
			return
		}
		ctx := context.WithValue(r.Context(), ctxUserID, userID)
		ctx = context.WithValue(ctx, ctxRole, role)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func requireRole(role domain.Role) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if roleFrom(r.Context()) != role {
				respondError(w, http.StatusForbidden, "this account does not have access to that feature")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
