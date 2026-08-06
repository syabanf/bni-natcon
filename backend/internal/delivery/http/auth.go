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
	if err != nil || !parsed.Valid || c.Role == "" {
		return 0, "", fmt.Errorf("invalid token")
	}
	if _, err := fmt.Sscanf(c.Subject, "%d", &userID); err != nil {
		return 0, "", fmt.Errorf("invalid token subject")
	}
	return userID, domain.Role(c.Role), nil
}

// BcryptVerifier implements usecase.PasswordVerifier and usecase.PasswordHasher.
type BcryptVerifier struct{}

func (BcryptVerifier) Verify(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

func (BcryptVerifier) Hash(password string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(b), err
}

// Reset tokens are deliberately separate from session tokens: a short TTL and
// a purpose claim the auth middleware never accepts.
const resetTokenTTL = 15 * time.Minute

type resetClaims struct {
	Purpose string `json:"purpose"`
	jwt.RegisteredClaims
}

func (j *JWTIssuer) IssueReset(userID int64) (string, error) {
	c := resetClaims{
		Purpose: "password-reset",
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   fmt.Sprintf("%d", userID),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(resetTokenTTL)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, c).SignedString(j.secret)
}

func (j *JWTIssuer) ParseReset(token string) (int64, error) {
	var c resetClaims
	parsed, err := jwt.ParseWithClaims(token, &c, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method %v", t.Header["alg"])
		}
		return j.secret, nil
	})
	if err != nil || !parsed.Valid || c.Purpose != "password-reset" {
		return 0, fmt.Errorf("invalid reset token")
	}
	var userID int64
	if _, err := fmt.Sscanf(c.Subject, "%d", &userID); err != nil {
		return 0, fmt.Errorf("invalid reset token subject")
	}
	return userID, nil
}
