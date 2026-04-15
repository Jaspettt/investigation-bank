package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"credit-mvp/internal/middleware"
	"credit-mvp/internal/models"

	"github.com/go-chi/chi/v5"
)

type createLoanRequest struct {
	AmountCents int64  `json:"amount_cents"`
	Currency    string `json:"currency"`
	TermMonths  int    `json:"term_months"`
	Purpose     string `json:"purpose"`
}

type decisionRequest struct {
	Status string `json:"status"`
	Reason string `json:"reason"`
}

func (h *Handler) CreateLoan(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value(middleware.CtxUserID).(uint)

	var req createLoanRequest
	if err := decodeJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid input"})
		return
	}
	req.Currency = strings.ToUpper(strings.TrimSpace(req.Currency))
	req.Purpose = strings.TrimSpace(req.Purpose)
	if req.AmountCents < 10000 || req.AmountCents > 10000000000 ||
		req.TermMonths < 1 || req.TermMonths > 120 ||
		(req.Currency != "USD" && req.Currency != "EUR" && req.Currency != "RUB") ||
		len(req.Purpose) < 5 || len(req.Purpose) > 500 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid input"})
		return
	}

	app := models.LoanApplication{
		ApplicantID: userID,
		AmountCents: req.AmountCents,
		Currency:    req.Currency,
		TermMonths:  req.TermMonths,
		Purpose:     req.Purpose,
		Status:      models.LoanPending,
	}

	if err := h.DB.Create(&app).Error; err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create application"})
		return
	}

	h.audit(&userID, "loan_create", "loan_application", uintToString(app.ID), true, "new application", clientIP(r))
	writeJSON(w, http.StatusCreated, loanResponse(app))
}

func (h *Handler) ListMyLoans(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value(middleware.CtxUserID).(uint)

	var apps []models.LoanApplication
	if err := h.DB.Where("applicant_id = ?", userID).Order("created_at DESC").Find(&apps).Error; err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to fetch loans"})
		return
	}

	resp := make([]map[string]any, 0, len(apps))
	for _, a := range apps {
		resp = append(resp, loanResponse(a))
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": resp})
}

func (h *Handler) GetLoan(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseUint(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid id"})
		return
	}

	userID, _ := r.Context().Value(middleware.CtxUserID).(uint)
	role, _ := r.Context().Value(middleware.CtxRole).(string)

	var app models.LoanApplication
	if err := h.DB.First(&app, uint(id)).Error; err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "loan not found"})
		return
	}

	// Object-level authorization: client can read only own applications.
	if role == string(models.RoleClient) && app.ApplicantID != userID {
		h.audit(&userID, "loan_read_denied", "loan_application", uintToString(app.ID), false, "object-level access denied", clientIP(r))
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
		return
	}

	writeJSON(w, http.StatusOK, loanResponse(app))
}

func (h *Handler) ManagerListPending(w http.ResponseWriter, _ *http.Request) {
	var apps []models.LoanApplication
	if err := h.DB.Where("status = ?", models.LoanPending).Order("created_at ASC").Find(&apps).Error; err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to fetch loans"})
		return
	}

	resp := make([]map[string]any, 0, len(apps))
	for _, a := range apps {
		resp = append(resp, loanResponse(a))
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": resp})
}

func (h *Handler) ManagerDecision(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseUint(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid id"})
		return
	}

	var req decisionRequest
	if err := decodeJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid input"})
		return
	}
	req.Status = strings.TrimSpace(req.Status)
	req.Reason = strings.TrimSpace(req.Reason)
	if (req.Status != "approved" && req.Status != "rejected") || len(req.Reason) < 5 || len(req.Reason) > 500 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid input"})
		return
	}

	managerID, _ := r.Context().Value(middleware.CtxUserID).(uint)

	var app models.LoanApplication
	if err := h.DB.First(&app, uint(id)).Error; err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "loan not found"})
		return
	}
	if app.Status != models.LoanPending {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "decision already made"})
		return
	}

	status := models.LoanStatus(req.Status)
	app.Status = status
	reason := strings.TrimSpace(req.Reason)
	app.DecisionReason = &reason
	app.DecidedByID = &managerID

	if err := h.DB.Save(&app).Error; err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to update status"})
		return
	}

	h.audit(&managerID, "loan_decision", "loan_application", uintToString(app.ID), true, "status="+string(status), clientIP(r))
	writeJSON(w, http.StatusOK, loanResponse(app))
}

func loanResponse(app models.LoanApplication) map[string]any {
	return map[string]any{
		"id":              app.ID,
		"applicant_id":    app.ApplicantID,
		"amount_cents":    app.AmountCents,
		"currency":        app.Currency,
		"term_months":     app.TermMonths,
		"purpose":         app.Purpose,
		"status":          app.Status,
		"decision_reason": app.DecisionReason,
		"created_at":      app.CreatedAt,
	}
}
