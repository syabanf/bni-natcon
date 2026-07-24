package usecase

import (
	"context"
	"errors"
	"strings"

	"natcon2026/backend/internal/domain"
)

// TokenIssuer abstracts JWT creation so the usecase stays infrastructure-free.
type TokenIssuer interface {
	Issue(userID int64, role domain.Role) (string, error)
}

// PasswordVerifier abstracts bcrypt comparison.
type PasswordVerifier interface {
	Verify(hash, password string) bool
}

type AuthUsecase struct {
	users    domain.UserRepository
	tokens   TokenIssuer
	verifier PasswordVerifier
}

func NewAuthUsecase(users domain.UserRepository, tokens TokenIssuer, verifier PasswordVerifier) *AuthUsecase {
	return &AuthUsecase{users: users, tokens: tokens, verifier: verifier}
}

func (u *AuthUsecase) Login(ctx context.Context, email, password string) (string, *domain.User, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	user, err := u.users.GetByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return "", nil, domain.ErrInvalidCredentials
		}
		return "", nil, err
	}
	if !u.verifier.Verify(user.PasswordHash, password) {
		return "", nil, domain.ErrInvalidCredentials
	}
	token, err := u.tokens.Issue(user.ID, user.Role)
	if err != nil {
		return "", nil, err
	}
	return token, user, nil
}
