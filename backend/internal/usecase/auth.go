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
	// A choice token names the accounts a verified password unlocked; it is
	// exchanged for a session once the attendee picks one.
	IssueChoice(userIDs []int64) (string, error)
	ParseChoice(token string) ([]int64, error)
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

// RecordConsent is what the consent checkbox on the first-run screen calls.
func (u *AuthUsecase) RecordConsent(ctx context.Context, userID int64) error {
	return u.users.RecordConsent(ctx, userID)
}

// ForgotPassword checks an attendee's chapter against the phone number on
// their ticket and hands back a short-lived reset token plus enough of their
// identity for the UI to confirm it found the right person.
// RecoverableAccount is one account password recovery turned up, with the
// token that resets it.
type RecoverableAccount struct {
	User       *domain.User
	ResetToken string
}

// ForgotPassword checks an attendee's chapter against the phone number on
// their ticket. Two tickets bought together share both, so this can hand back
// more than one account for the attendee to choose from.
func (u *AuthUsecase) ForgotPassword(ctx context.Context, chapter, phone string) ([]RecoverableAccount, error) {
	chapter, phone = strings.TrimSpace(chapter), strings.TrimSpace(phone)
	if chapter == "" || phone == "" {
		return nil, invalid("chapter and phone number are required")
	}
	users, err := u.users.FindMembersByChapterPhone(ctx, chapter, phone)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil, domain.ErrInvalidCredentials
		}
		return nil, err
	}
	out := make([]RecoverableAccount, 0, len(users))
	for _, user := range users {
		token, err := u.tokens.IssueReset(user.ID)
		if err != nil {
			return nil, err
		}
		out = append(out, RecoverableAccount{User: user, ResetToken: token})
	}
	return out, nil
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

// LoginResult is either a session (one account answered) or a choice (a buyer
// holding two tickets has two attendee accounts on the same address).
type LoginResult struct {
	Token    string
	User     *domain.User
	Choice   string // choice token, set only when Candidates has more than one
	Accounts []*domain.User
}

func (u *AuthUsecase) Login(ctx context.Context, email, password string) (*LoginResult, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	users, err := u.users.ListByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil, domain.ErrInvalidCredentials
		}
		return nil, err
	}
	// Each account carries its own password, so only the ones the typed
	// password actually opens are offered.
	//
	// While an account is still on the password we generated for it, the
	// lowercase spelling is accepted too: every generated password is
	// all-lowercase by construction (a booth's name + stand, an attendee's
	// chapter + first name), and a phone keyboard capitalises the first
	// letter the moment somebody taps "show password". Nothing is weakened —
	// the real secret is lowercase either way — and it saves a crew from
	// being locked out at the door on the busiest morning. Once they choose
	// their own password, it is matched exactly.
	lowered := strings.ToLower(password)
	var matched []*domain.User
	for _, candidate := range users {
		if u.verifier.Verify(candidate.PasswordHash, password) {
			matched = append(matched, candidate)
			continue
		}
		if candidate.MustSetPassword && lowered != password &&
			u.verifier.Verify(candidate.PasswordHash, lowered) {
			matched = append(matched, candidate)
		}
	}
	if len(matched) == 0 {
		return nil, domain.ErrInvalidCredentials
	}
	if len(matched) == 1 {
		return u.session(matched[0])
	}
	ids := make([]int64, 0, len(matched))
	for _, m := range matched {
		ids = append(ids, m.ID)
	}
	choice, err := u.tokens.IssueChoice(ids)
	if err != nil {
		return nil, err
	}
	return &LoginResult{Choice: choice, Accounts: matched}, nil
}

// SelectAccount finishes a sign-in that offered a choice.
func (u *AuthUsecase) SelectAccount(ctx context.Context, choiceToken string, userID int64) (*LoginResult, error) {
	ids, err := u.tokens.ParseChoice(choiceToken)
	if err != nil {
		return nil, invalid("this sign-in has expired — please sign in again")
	}
	allowed := false
	for _, id := range ids {
		if id == userID {
			allowed = true
			break
		}
	}
	if !allowed {
		return nil, domain.ErrInvalidCredentials
	}
	user, err := u.users.GetByID(ctx, userID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil, domain.ErrInvalidCredentials
		}
		return nil, err
	}
	return u.session(user)
}

func (u *AuthUsecase) session(user *domain.User) (*LoginResult, error) {
	token, err := u.tokens.Issue(user.ID, user.Role)
	if err != nil {
		return nil, err
	}
	return &LoginResult{Token: token, User: user}, nil
}
