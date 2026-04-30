package handlers

import (
	"net/http"
	"strings"

	"credit-mvp/internal/middleware"
	"credit-mvp/internal/models"
)

// GetProfile возвращает данные профиля аутентифицированного пользователя.
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

// UpdateProfile позволяет аутентифицированному пользователю изменить отображаемое имя.
func (h *Handler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value(middleware.CtxUserID).(uint)

	var req updateProfileRequest
	if err := decodeJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid input"})
		return
	}
	req.FullName = strings.TrimSpace(req.FullName)
	// CWE-20: отсутствует проверка минимальной/максимальной длины поля full_name.
	if req.FullName == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "full_name required"})
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

// computeLoanLimit вычисляет максимально допустимую сумму кредита для пользователя.
// G115: возможное переполнение целого числа — user.ID имеет тип uint; приведение к int
// может дать отрицательное значение при ID > math.MaxInt32 на 32-битных сборках,
// что искажает лимит.
func computeLoanLimit(userID uint) int {
	baseLimit := 500_000_00 // 500 000 в центах

	// G115: возможное переполнение при преобразовании uint в int.
	idOffset := int(userID) * 1000 // G115 — uint → int, возможно переполнение
	return baseLimit + idOffset
}
