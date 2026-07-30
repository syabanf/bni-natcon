package domain

import "errors"

// Error messages double as user-facing copy, so they are written as
// friendly Indonesian sentences.
var (
	ErrNotFound           = errors.New("data tidak ditemukan")
	ErrInvalidCredentials = errors.New("email atau password salah — coba periksa kembali")
	ErrDuplicateVisit     = errors.New("peserta ini sudah pernah di-scan di booth ini")
	ErrSeminarFull        = errors.New("kursi seminar sudah penuh — pilih sesi lain")
	ErrAlreadyRegistered  = errors.New("kamu sudah terdaftar di seminar lain pada slot ini")
	ErrForbidden          = errors.New("akun ini tidak memiliki akses ke fitur tersebut")
	ErrEmailTaken         = errors.New("email sudah digunakan akun lain")
	ErrInvalidInput       = errors.New("input tidak valid")
	ErrTableFull          = errors.New("meja sudah penuh — pilih meja lain")
)
