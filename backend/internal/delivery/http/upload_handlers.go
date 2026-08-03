package http

import (
	"crypto/rand"
	"encoding/hex"
	"io"
	"net/http"
	"os"
	"path/filepath"
)

// Image uploads (seminar covers) are stored on the local filesystem under
// UploadDir and served back at /uploads/<name>.

const maxUploadBytes = 5 << 20 // 5 MiB per image

var imageExts = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
	"image/gif":  ".gif",
}

func (s *Server) handleAdminUpload(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(maxUploadBytes); err != nil {
		respondError(w, http.StatusBadRequest, "file is too large — maximum 5 MB")
		return
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		respondError(w, http.StatusBadRequest, "no file in the request — send it as the \"file\" field")
		return
	}
	defer file.Close()

	// Sniff the real content type; the client-declared one is untrusted.
	head := make([]byte, 512)
	n, _ := io.ReadFull(file, head)
	ext, ok := imageExts[http.DetectContentType(head[:n])]
	if !ok {
		respondError(w, http.StatusBadRequest, "only JPG, PNG, WEBP, or GIF images are accepted")
		return
	}

	if err := os.MkdirAll(s.uploadDir, 0o755); err != nil {
		respondDomainError(w, err)
		return
	}
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		respondDomainError(w, err)
		return
	}
	name := hex.EncodeToString(buf) + ext
	dst, err := os.Create(filepath.Join(s.uploadDir, name))
	if err != nil {
		respondDomainError(w, err)
		return
	}
	defer dst.Close()
	if _, err := dst.Write(head[:n]); err != nil {
		respondDomainError(w, err)
		return
	}
	if _, err := io.Copy(dst, io.LimitReader(file, maxUploadBytes)); err != nil {
		respondDomainError(w, err)
		return
	}

	respondJSON(w, http.StatusCreated, map[string]string{"url": "/uploads/" + name})
}

// uploadsHandler serves stored images; names are generated hex so plain
// FileServer over the flat directory is safe.
func (s *Server) uploadsHandler() http.Handler {
	return http.StripPrefix("/uploads/", http.FileServer(http.Dir(s.uploadDir)))
}
