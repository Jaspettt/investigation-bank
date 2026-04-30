package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"credit-mvp/internal/middleware"
	"credit-mvp/internal/models"
	"github.com/go-chi/chi/v5"
	"gorm.io/gorm"
)

const (
	maxDocumentSizeBytes = 5 << 20 // 5 MB
)

var allowedDocumentExt = map[string]struct{}{
	".pdf":  {},
	".jpg":  {},
	".jpeg": {},
	".png":  {},
}

var safeStoredFilenameRE = regexp.MustCompile(`^[a-f0-9]{32}\.(pdf|jpg|jpeg|png)$`)

// UploadDocument сохраняет файл, прикреплённый к кредитной заявке.
func (h *Handler) UploadDocument(w http.ResponseWriter, r *http.Request) {
	loanID := chi.URLParam(r, "id")
	loan, err := h.authorizedLoanForDocument(r, loanID)
	if err != nil {
		h.writeDocumentAuthError(w, err)
		return
	}

	if err := r.ParseMultipartForm(maxDocumentSizeBytes); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid form"})
		return
	}

	file, header, err := r.FormFile("document")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing file"})
		return
	}
	defer file.Close()
	if header.Size <= 0 || header.Size > maxDocumentSizeBytes {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid file size"})
		return
	}
	if !isAllowedDocument(header) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unsupported file type"})
		return
	}

	uploadDir := fmt.Sprintf("uploads/loans/%s", loanID)

	if err := os.MkdirAll(uploadDir, 0750); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "storage error"})
		return
	}

	ext := strings.ToLower(filepath.Ext(header.Filename))
	safeName, err := safeStorageName(ext)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "storage error"})
		return
	}
	destPath := filepath.Join(uploadDir, safeName)
	out, err := os.OpenFile(destPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0600)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "storage error"})
		return
	}
	defer out.Close()

	if _, err := io.Copy(out, file); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "write error"})
		return
	}

	writeJSON(w, http.StatusCreated, map[string]string{
		"filename": safeName,
		"loan_id":  fmt.Sprintf("%d", loan.ID),
	})
}

// DownloadDocument отдаёт ранее загруженный файл.
func (h *Handler) DownloadDocument(w http.ResponseWriter, r *http.Request) {
	loanID := chi.URLParam(r, "id")
	filename := chi.URLParam(r, "filename")
	if strings.Contains(filename, "/") || strings.Contains(filename, "\\") {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid filename"})
		return
	}
	if !safeStoredFilenameRE.MatchString(strings.ToLower(filename)) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid filename"})
		return
	}
	if _, ok := allowedDocumentExt[strings.ToLower(filepath.Ext(filename))]; !ok {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unsupported file type"})
		return
	}
	if _, err := h.authorizedLoanForDocument(r, loanID); err != nil {
		h.writeDocumentAuthError(w, err)
		return
	}

	filePath := fmt.Sprintf("uploads/loans/%s/%s", loanID, filename)
	f, err := os.Open(filePath)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "document not found"})
		return
	}
	defer f.Close()

	w.Header().Set("Content-Disposition", "attachment; filename="+filename)
	w.Header().Set("Content-Type", "application/octet-stream")
	io.Copy(w, f) //nolint:errcheck
}

func (h *Handler) authorizedLoanForDocument(r *http.Request, rawLoanID string) (*models.LoanApplication, error) {
	var loan models.LoanApplication
	if err := h.DB.Select("id", "applicant_id").First(&loan, rawLoanID).Error; err != nil {
		return nil, err
	}
	role, _ := r.Context().Value(middleware.CtxRole).(string)
	userID, _ := r.Context().Value(middleware.CtxUserID).(uint)
	if role == string(models.RoleClient) && loan.ApplicantID != userID {
		return nil, errors.New("forbidden")
	}
	return &loan, nil
}

func (h *Handler) writeDocumentAuthError(w http.ResponseWriter, err error) {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "loan not found"})
		return
	}
	if err.Error() == "forbidden" {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
		return
	}
	writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "query failed"})
}

func isAllowedDocument(header *multipart.FileHeader) bool {
	ext := strings.ToLower(filepath.Ext(header.Filename))
	_, ok := allowedDocumentExt[ext]
	return ok
}

func safeStorageName(ext string) (string, error) {
	name, err := randomSafeFileID()
	if err != nil {
		return "", err
	}
	return name + ext, nil
}

func randomSafeFileID() (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}
