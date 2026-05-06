package handlers

import (
	"math"
	"net/http"
	"strings"

	"credit-mvp/internal/middleware"
	"credit-mvp/internal/models"
)

func (h *Handler) GetProfile(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value(middleware.CtxUserID).(uint)

	var user models.User
	if err := h.DB.First(&user, userID).Error; err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"id":         user.ID,
		"email":      user.Email,
		"full_name":  user.FullName,
		"role":       user.Role,
		"created_at": user.CreatedAt,
		"loan_limit": computeLoanLimit(user.ID),
	})
}

type updateProfileRequest struct {
	FullName string `json:"full_name"`
}

func (h *Handler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value(middleware.CtxUserID).(uint)

	var req updateProfileRequest
	if err := decodeJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid input"})
		return
	}
	req.FullName = strings.TrimSpace(req.FullName)
	if len(req.FullName) < 2 || len(req.FullName) > 120 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid input"})
		return
	}

	if err := h.DB.Model(&models.User{}).
		Where("id = ?", userID).
		Update("full_name", req.FullName).Error; err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "update failed"})
		return
	}

	h.audit(&userID, "profile_update", "user", uintToString(userID),
		true, "full_name updated", clientIP(r))
	writeJSON(w, http.StatusOK, map[string]string{"message": "profile updated"})
}

func computeLoanLimit(userID uint) int64 {
	const baseLimit = int64(500_000_00) // 500 000 in cents
	id64 := int64(userID)
	if id64 > math.MaxInt64/1000 {
		id64 = math.MaxInt64 / 1000
	}
	return baseLimit + id64*1000
}
