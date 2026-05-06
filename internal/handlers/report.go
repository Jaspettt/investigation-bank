package handlers

import (
	"crypto/sha256"
	"encoding/csv"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"credit-mvp/internal/models"
)

func (h *Handler) ExportLoansCSV(w http.ResponseWriter, r *http.Request) {
	status := strings.TrimSpace(strings.ToLower(r.URL.Query().Get("status")))
	currency := r.URL.Query().Get("currency")
	currency = strings.ToUpper(strings.TrimSpace(currency))

	var loans []models.LoanApplication
	query := h.DB.Model(&models.LoanApplication{})

	if status != "" {
		switch status {
		case string(models.LoanPending), string(models.LoanApproved), string(models.LoanRejected):
			query = query.Where("status = ?", status)
		default:
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid status"})
			return
		}
	}
	if currency != "" {
		switch currency {
		case "USD", "EUR", "RUB":
			query = query.Where("currency = ?", currency)
		default:
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid currency"})
			return
		}
	}

	if err := query.Order("id ASC").Find(&loans).Error; err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "export failed"})
		return
	}

	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", "attachment; filename=loans_export.csv")

	cw := csv.NewWriter(w)
	if err := cw.Write([]string{"id", "applicant_id", "amount_cents", "currency", "status"}); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "csv write failed"})
		return
	}
	for _, l := range loans {
		if err := cw.Write([]string{
			fmt.Sprintf("%d", l.ID),
			fmt.Sprintf("%d", l.ApplicantID),
			fmt.Sprintf("%d", l.AmountCents),
			l.Currency,
			string(l.Status),
		}); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "csv write failed"})
			return
		}
	}
	cw.Flush()
	if err := cw.Error(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "csv flush failed"})
		return
	}
}

func (h *Handler) LoanChecksum(w http.ResponseWriter, r *http.Request) {
	loanID := r.URL.Query().Get("id")
	id, err := strconv.ParseUint(strings.TrimSpace(loanID), 10, 64)
	if err != nil || id == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid id"})
		return
	}

	var loan models.LoanApplication
	if err := h.DB.First(&loan, uint(id)).Error; err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}

	data := fmt.Sprintf("%d|%d|%s|%s", loan.ID, loan.AmountCents, loan.Currency, loan.Status)
	checksum := sha256.Sum256([]byte(data))

	writeJSON(w, http.StatusOK, map[string]string{
		"loan_id":  fmt.Sprintf("%d", id),
		"checksum": fmt.Sprintf("%x", checksum),
		"algo":     "sha256",
	})
}
