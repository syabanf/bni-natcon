package domain

import "errors"

var (
	ErrNotFound           = errors.New("resource not found")
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrDuplicateVisit     = errors.New("member already scanned at this booth")
	ErrSeminarFull        = errors.New("seminar is full")
	ErrAlreadyRegistered  = errors.New("already registered for a seminar in this slot")
	ErrForbidden          = errors.New("forbidden")
	ErrEmailTaken         = errors.New("email is already in use")
	ErrInvalidInput       = errors.New("invalid input")
	ErrTableFull          = errors.New("meja sudah penuh")
)
