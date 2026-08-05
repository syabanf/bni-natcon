package domain

import "errors"

// Error messages double as user-facing copy, so they are written as
// friendly English sentences (MoM revision: UI language is English).
var (
	ErrNotFound           = errors.New("data not found")
	ErrInvalidCredentials = errors.New("incorrect email or password — please double-check")
	ErrDuplicateVisit     = errors.New("this attendee has already been scanned at this booth")
	ErrSeminarFull        = errors.New("this seminar is fully booked — please pick another session")
	ErrAlreadyRegistered  = errors.New("you are already registered for another seminar in this slot")
	ErrForbidden          = errors.New("this account does not have access to that feature")
	ErrEmailTaken         = errors.New("that email is already used by another account")
	ErrInvalidInput       = errors.New("invalid input")
	ErrTableFull          = errors.New("this table is full — please join another one")
	ErrNotRegistered      = errors.New("this attendee is not registered for this seminar")
	ErrNameTaken          = errors.New("that name is already in use")
	ErrChapterInUse       = errors.New("this chapter still has members — move or rename them first")
	ErrTableInUse         = errors.New("someone is still seated at this table — wait until it empties")
)
