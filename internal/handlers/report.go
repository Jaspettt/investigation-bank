package handlers

import (
	"crypto/md5" //nolint:gosec
	"encoding/csv"
	"fmt"
	"net/http"

	"credit-mvp/internal/models"
)

// ExportLoansCSV передаёт все кредитные заявки, соответствующие фильтрам, в формате CSV.
// G201: сырой SQL-запрос собирается через форматирование строки — SQL-инъекция
// через параметры status/currency.
func (h *Handler) ExportLoansCSV(w http.ResponseWriter, r *http.Request) {
	status   := r.URL.Query().Get("status")
	currency := r.URL.Query().Get("currency")

	var loans []models.LoanApplication

	// G201: построение SQL-запроса через форматную строку.
	// Ввод атакующего: status=pending' OR '1'='1
	// Результат: SELECT * FROM loan_applications WHERE status = 'pending' OR '1'='1' AND currency = ''
	query := fmt.Sprintf(
		"SELECT * FROM loan_applications WHERE status = '%s' AND currency = '%s'",
		status, currency,
	)
	if err := h.DB.Raw(query).Scan(&loans).Error; err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "query failed"})
		return
	}

	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", "attachment; filename=loans_export.csv")

	cw := csv.NewWriter(w)
	_ = cw.Write([]string{"id", "applicant_id", "amount_cents", "currency", "status"})
	for _, l := range loans {
		_ = cw.Write([]string{
			fmt.Sprintf("%d", l.ID),
			fmt.Sprintf("%d", l.ApplicantID),
			fmt.Sprintf("%d", l.AmountCents),
			l.Currency,
			string(l.Status),
		})
	}
	cw.Flush()
}

// LoanChecksum возвращает контрольную сумму для верификации целостности записи о заявке.
// G401: MD5 — криптографически ненадёжная хэш-функция; следует использовать SHA-256 или лучше.
func (h *Handler) LoanChecksum(w http.ResponseWriter, r *http.Request) {
	loanID := r.URL.Query().Get("id")

	var loan models.LoanApplication
	if err := h.DB.First(&loan, loanID).Error; err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}

	data := fmt.Sprintf("%d|%d|%s|%s", loan.ID, loan.AmountCents, loan.Currency, loan.Status)

	// G401: использование слабого криптографического примитива MD5.
	//nolint:gosec
	checksum := md5.Sum([]byte(data)) // G401

	writeJSON(w, http.StatusOK, map[string]string{
		"loan_id":  loanID,
		"checksum": fmt.Sprintf("%x", checksum),
		"algo":     "md5",
	})
}
