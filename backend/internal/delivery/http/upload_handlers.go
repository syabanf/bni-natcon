package http

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"
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
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) || strings.Contains(err.Error(), "too large") {
			respondError(w, http.StatusRequestEntityTooLarge,
				"that image is larger than 5 MB — resize it, or export it at a smaller quality")
			return
		}
		respondError(w, http.StatusBadRequest,
			"the upload could not be read — send the image as the \"file\" field of a form")
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
	sniffed := http.DetectContentType(head[:n])
	ext, ok := imageExts[sniffed]
	if !ok {
		respondError(w, http.StatusUnsupportedMediaType, unsupportedImageMessage(head[:n], sniffed))
		return
	}

	if err := os.MkdirAll(s.uploadDir, 0o755); err != nil {
		respondUploadDirError(w, s.uploadDir, err)
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
		respondUploadDirError(w, s.uploadDir, err)
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

// unsupportedImageMessage names what actually arrived. "Only JPG, PNG, WEBP
// or GIF" is true but unhelpful to someone who just picked a photo off an
// iPhone and has no idea it is HEIC, or who grabbed the wrong file entirely.
func unsupportedImageMessage(head []byte, sniffed string) string {
	const accepted = "Accepted: JPG, PNG, WEBP or GIF."
	switch {
	case isHEIC(head):
		return "That looks like an iPhone HEIC photo, which browsers cannot display. " +
			"In Settings › Camera › Formats pick \"Most Compatible\", or share the photo " +
			"to yourself first — it converts to JPG. " + accepted
	case strings.HasPrefix(sniffed, "application/pdf"):
		return "That is a PDF, not an image. " + accepted
	case strings.HasPrefix(sniffed, "text/"), strings.Contains(sniffed, "spreadsheet"),
		strings.Contains(sniffed, "zip"):
		return "That is a document, not an image. " + accepted
	case strings.HasPrefix(sniffed, "video/"):
		return "That is a video, not an image. " + accepted
	}
	return "That file is not an image the browser can show. " + accepted
}

// isHEIC checks the ISO base-media brand, which http.DetectContentType does
// not know: bytes 4..8 are "ftyp", then a brand like heic/heif/hevc/mif1.
func isHEIC(head []byte) bool {
	if len(head) < 12 || !bytes.Equal(head[4:8], []byte("ftyp")) {
		return false
	}
	switch string(head[8:12]) {
	case "heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs", "mif1", "msf1":
		return true
	}
	return false
}

// respondUploadDirError explains a storage failure instead of hiding it
// behind "something went wrong on our side".
//
// This endpoint is admin-only, and the person who sees it is the one who can
// fix it: an upload directory the API cannot write to is a deployment
// setting, not a bad request. Naming UPLOAD_DIR turns a mystery 500 into a
// one-line instruction — without it, the only clue is a stack trace in the
// browser console and a server log nobody is watching mid-event.
func respondUploadDirError(w http.ResponseWriter, dir string, err error) {
	slog.Error("upload storage unavailable", "dir", dir, "err", err)
	if errors.Is(err, os.ErrPermission) {
		respondError(w, http.StatusInternalServerError, fmt.Sprintf(
			"the server cannot write to its image folder (%s) — the volume is not writable "+
				"by the API. Fix the permissions on that path, or point UPLOAD_DIR somewhere writable.", dir))
		return
	}
	respondError(w, http.StatusInternalServerError, fmt.Sprintf(
		"the server could not store the image in %s — check that the path exists and has free space.", dir))
}

// EnsureUploadDir is called at start-up so a misconfigured volume is found
// while someone is still looking at the deploy, not when the committee tries
// to set a cover. It never stops the API: everything except image upload
// works without it.
func EnsureUploadDir(dir string) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		slog.Error("UPLOAD_DIR is not usable — image uploads will fail", "dir", dir, "err", err)
		return
	}
	probe := filepath.Join(dir, ".write-probe")
	if err := os.WriteFile(probe, []byte("ok"), 0o600); err != nil {
		slog.Error("UPLOAD_DIR exists but is not writable — image uploads will fail",
			"dir", dir, "err", err)
		return
	}
	_ = os.Remove(probe)
	slog.Info("image uploads ready", "dir", dir)
}
