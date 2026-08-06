package usecase

import (
	"context"
	"errors"
	"strings"

	"natcon2026/backend/internal/domain"
)

// TokenIssuer abstracts JWT creation so the usecase stays infrastructure-free.
// A reset token is a separate, short-lived credential: it only unlocks the
// "choose a new password" call, never the API itself.
type TokenIssuer interface {
	Issue(userID int64, role domain.Role) (string, error)
	IssueReset(userID int64) (string, error)
	ParseReset(token string) (int64, error)
}

// PasswordVerifier abstracts bcrypt comparison.
type PasswordVerifier interface {
	Verify(hash, password string) bool
}

type AuthUsecase struct {
	users    domain.UserRepository
	tokens   TokenIssuer
	verifier PasswordVerifier
	hasher   PasswordHasher
}

func NewAuthUsecase(users domain.UserRepository, tokens TokenIssuer, verifier PasswordVerifier, hasher PasswordHasher) *AuthUsecase {
	return &AuthUsecase{users: users, tokens: tokens, verifier: verifier, hasher: hasher}
}

// MinPasswordLength keeps the bar low enough for a one-day event but high
// enough that a chapter name alone is not a password.
const MinPasswordLength = 8

func validPassword(p string) error {
	if len([]rune(strings.TrimSpace(p))) < MinPasswordLength {
		return invalid("password must be at least 8 characters")
	}
	return nil
}

// SetPassword is what the first-login screen calls: the account stops using
// the password generated at import time.
func (u *AuthUsecase) SetPassword(ctx context.Context, userID int64, newPassword string) error {
	if err := validPassword(newPassword); err != nil {
		return err
	}
	hash, err := u.hasher.Hash(newPassword)
	if err != nil {
		return err
	}
	return u.users.SetPassword(ctx, userID, hash)
}

// ForgotPassword checks an attendee's chapter against the phone number on
// their ticket and hands back a short-lived reset token plus enough of their
// identity for the UI to confirm it found the right person.
func (u *AuthUsecase) ForgotPassword(ctx context.Context, chapter, phone string) (string, *domain.User, error) {
	chapter, phone = strings.TrimSpace(chapter), strings.TrimSpace(phone)
	if chapter == "" || phone == "" {
		return "", nil, invalid("chapter and phone number are required")
	}
	user, err := u.users.FindMemberByChapterPhone(ctx, chapter, phone)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return "", nil, domain.ErrInvalidCredentials
		}
		return "", nil, err
	}
	token, err := u.tokens.IssueReset(user.ID)
	if err != nil {
		return "", nil, err
	}
	return token, user, nil
}

// ResetPassword consumes the token from ForgotPassword.
func (u *AuthUsecase) ResetPassword(ctx context.Context, token, newPassword string) error {
	userID, err := u.tokens.ParseReset(token)
	if err != nil {
		return invalid("this reset link has expired — start again")
	}
	if err := validPassword(newPassword); err != nil {
		return err
	}
	hash, err := u.hasher.Hash(newPassword)
	if err != nil {
		return err
	}
	return u.users.SetPassword(ctx, userID, hash)
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
