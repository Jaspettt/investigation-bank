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
	"strconv"
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

	r.Body = http.MaxBytesReader(w, r.Body, maxDocumentSizeBytes+1024)
	reader, err := r.MultipartReader()
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid form"})
		return
	}

	part, originalFilename, err := findDocumentPart(reader)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing file"})
		return
	}
	defer part.Close()
	if !isAllowedDocumentFilename(originalFilename) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unsupported file type"})
		return
	}

	if err := os.MkdirAll(filepath.Join("uploads", "loans"), 0750); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "storage error"})
		return
	}

	loansRoot, err := os.OpenRoot(filepath.Join("uploads", "loans"))
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "storage error"})
		return
	}
	defer loansRoot.Close()

	loanFolder := strconv.FormatUint(uint64(loan.ID), 10)
	if err := loansRoot.MkdirAll(loanFolder, 0750); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "storage error"})
		return
	}

	loanRoot, err := loansRoot.OpenRoot(loanFolder)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "storage error"})
		return
	}
	defer loanRoot.Close()

	ext := strings.ToLower(filepath.Ext(originalFilename))
	safeName, err := safeStorageName(ext)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "storage error"})
		return
	}
	out, err := loanRoot.OpenFile(safeName, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0600)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "storage error"})
		return
	}
	defer out.Close()

	written, err := io.Copy(out, io.LimitReader(part, maxDocumentSizeBytes+1))
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "write error"})
		return
	}
	if written <= 0 || written > maxDocumentSizeBytes {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid file size"})
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
	loan, err := h.authorizedLoanForDocument(r, loanID)
	if err != nil {
		h.writeDocumentAuthError(w, err)
		return
	}

	loansRoot, err := os.OpenRoot(filepath.Join("uploads", "loans"))
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "document not found"})
		return
	}
	defer loansRoot.Close()

	loanRoot, err := loansRoot.OpenRoot(strconv.FormatUint(uint64(loan.ID), 10))
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "document not found"})
		return
	}
	defer loanRoot.Close()

	f, err := loanRoot.Open(filename)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "document not found"})
		return
	}
	defer f.Close()

	w.Header().Set("Content-Disposition", "attachment; filename="+filename)
	w.Header().Set("Content-Type", "application/octet-stream")
	if _, err := io.Copy(w, f); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "read error"})
		return
	}
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

func isAllowedDocumentFilename(name string) bool {
	ext := strings.ToLower(filepath.Ext(name))
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

func findDocumentPart(reader *multipart.Reader) (*multipart.Part, string, error) {
	for {
		part, err := reader.NextPart()
		if err != nil {
			return nil, "", err
		}
		if part.FormName() == "document" && part.FileName() != "" {
			return part, part.FileName(), nil
		}
		_ = part.Close()
	}
}
