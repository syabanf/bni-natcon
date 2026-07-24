package http

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"natcon2026/backend/internal/domain"
)

// JWTIssuer implements usecase.TokenIssuer and validates tokens for the
// auth middleware.
type JWTIssuer struct {
	secret []byte
	ttl    time.Duration
}

func NewJWTIssuer(secret string, ttl time.Duration) *JWTIssuer {
	return &JWTIssuer{secret: []byte(secret), ttl: ttl}
}

type claims struct {
	Role string `json:"role"`
	jwt.RegisteredClaims
}

func (j *JWTIssuer) Issue(userID int64, role domain.Role) (string, error) {
	c := claims{
		Role: string(role),
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   fmt.Sprintf("%d", userID),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(j.ttl)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, c).SignedString(j.secret)
}

func (j *JWTIssuer) Parse(token string) (userID int64, role domain.Role, err error) {
	var c claims
	parsed, err := jwt.ParseWithClaims(token, &c, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method %v", t.Header["alg"])
		}
		return j.secret, nil
	})
	if err != nil || !parsed.Valid {
		return 0, "", fmt.Errorf("invalid token")
	}
	if _, err := fmt.Sscanf(c.Subject, "%d", &userID); err != nil {
		return 0, "", fmt.Errorf("invalid token subject")
	}
	return userID, domain.Role(c.Role), nil
}

// BcryptVerifier implements usecase.PasswordVerifier.
type BcryptVerifier struct{}

func (BcryptVerifier) Verify(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}
