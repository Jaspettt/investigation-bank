package handlers

import (
	"net/http"
	"strings"
	"time"

	"credit-mvp/internal/middleware"
	"credit-mvp/internal/models"

	"github.com/go-chi/chi/v5"
)

type createLoanCommentRequest struct {
	Category   string `json:"category"`
	Body       string `json:"body"`
	IsInternal bool   `json:"is_internal"`
}

func (h *Handler) ListLoanComments(w http.ResponseWriter, r *http.Request) {
	loanID := chi.URLParam(r, "id")
	loan, err := h.authorizedLoanForDocument(r, loanID)
	if err != nil {
		h.writeDocumentAuthError(w, err)
		return
	}

	userID, _ := r.Context().Value(middleware.CtxUserID).(uint)
	role, _ := r.Context().Value(middleware.CtxRole).(string)

	query := h.DB.Where("loan_id = ?", loan.ID).Order("created_at DESC")
	if role == string(models.RoleClient) {
		query = query.Where("is_internal = ?", false)
	}

	var comments []models.LoanComment
	if err := query.Find(&comments).Error; err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to fetch comments"})
		return
	}

	items := make([]map[string]any, 0, len(comments))
	for _, item := range comments {
		items = append(items, loanCommentResponse(item))
	}

	h.audit(&userID, "loan_comment_list", "loan_application", uintToString(loan.ID), true, "comment_count="+uintToString(uint(len(items))), clientIP(r))
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) CreateLoanComment(w http.ResponseWriter, r *http.Request) {
	loanID := chi.URLParam(r, "id")
	loan, err := h.authorizedLoanForDocument(r, loanID)
	if err != nil {
		h.writeDocumentAuthError(w, err)
		return
	}

	userID, _ := r.Context().Value(middleware.CtxUserID).(uint)
	role, _ := r.Context().Value(middleware.CtxRole).(string)

	var req createLoanCommentRequest
	if err := decodeJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid input"})
		return
	}
	req.Category = strings.ToLower(strings.TrimSpace(req.Category))
	req.Body = strings.TrimSpace(req.Body)
	if len(req.Body) < 5 || len(req.Body) > 500 || !isAllowedLoanCommentCategory(req.Category) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid input"})
		return
	}
	if role == string(models.RoleClient) {
		req.IsInternal = false
	}

	comment := models.LoanComment{
		LoanID:     loan.ID,
		AuthorID:   userID,
		Category:   req.Category,
		Body:       req.Body,
		IsInternal: req.IsInternal,
	}
	if err := h.DB.Create(&comment).Error; err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create comment"})
		return
	}

	h.audit(&userID, "loan_comment_create", "loan_application", uintToString(loan.ID), true, "category="+req.Category, clientIP(r))
	writeJSON(w, http.StatusCreated, loanCommentResponse(comment))
}

func isAllowedLoanCommentCategory(v string) bool {
	switch v {
	case "review", "risk", "verification", "follow_up":
		return true
	default:
		return false
	}
}

func loanCommentResponse(comment models.LoanComment) map[string]any {
	return map[string]any{
		"id":          comment.ID,
		"loan_id":     comment.LoanID,
		"author_id":   comment.AuthorID,
		"category":    comment.Category,
		"body":        comment.Body,
		"is_internal": comment.IsInternal,
		"created_at":  comment.CreatedAt.Format(time.RFC3339),
	}
}
