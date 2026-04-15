package handlers

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"credit-mvp/internal/middleware"
	"credit-mvp/internal/models"
	"credit-mvp/internal/security"
)

type registerRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	FullName string `json:"full_name"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type logoutRequest struct {
	RefreshToken string `json:"refresh_token"`
}

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := decodeJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid input"})
		return
	}
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.FullName = strings.TrimSpace(req.FullName)
	if !isValidEmail(req.Email) || len(req.Password) < 10 || len(req.Password) > 72 || len(req.FullName) < 2 || len(req.FullName) > 120 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid input"})
		return
	}

	hash, err := security.HashPassword(req.Password)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to register"})
		return
	}

	user := models.User{
		Email:        req.Email,
		PasswordHash: hash,
		FullName:     req.FullName,
		Role:         models.RoleClient,
	}

	if err := h.DB.Create(&user).Error; err != nil {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "user already exists"})
		return
	}

	uid := user.ID
	h.audit(&uid, "register", "user", uintToString(user.ID), true, "user registration", clientIP(r))
	writeJSON(w, http.StatusCreated, map[string]any{"id": user.ID, "email": user.Email, "role": user.Role})
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := decodeJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid credentials"})
		return
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	if !isValidEmail(email) || len(req.Password) < 10 || len(req.Password) > 72 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid credentials"})
		return
	}
	key := clientIP(r) + "|" + email
	if h.LoginLimiter.IsBlocked(key) {
		writeJSON(w, http.StatusTooManyRequests, map[string]string{"error": "too many attempts, try later"})
		return
	}

	var user models.User
	if err := h.DB.Where("email = ?", email).First(&user).Error; err != nil {
		h.LoginLimiter.RegisterFailure(key)
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid credentials"})
		return
	}
	if err := security.CheckPassword(user.PasswordHash, req.Password); err != nil {
		h.LoginLimiter.RegisterFailure(key)
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid credentials"})
		return
	}
	h.LoginLimiter.RegisterSuccess(key)

	accessToken, refreshToken, err := h.issueTokens(user.ID, string(user.Role))
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to issue token"})
		return
	}

	uid := user.ID
	h.audit(&uid, "login", "user", uintToString(user.ID), true, "user login", clientIP(r))

	writeJSON(w, http.StatusOK, map[string]any{
		"access_token":  accessToken,
		"refresh_token": refreshToken,
		"token_type":    "bearer",
		"expires_in":    int(h.Config.AccessTokenTTL.Seconds()),
	})
}

func (h *Handler) Refresh(w http.ResponseWriter, r *http.Request) {
	var req refreshRequest
	if err := decodeJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid token"})
		return
	}
	if l := len(strings.TrimSpace(req.RefreshToken)); l < 32 || l > 300 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid token"})
		return
	}

	hash := security.HashToken(req.RefreshToken)
	var dbToken models.RefreshToken
	err := h.DB.Where("token_hash = ? AND revoked_at IS NULL", hash).First(&dbToken).Error
	if err != nil || dbToken.ExpiresAt.Before(time.Now().UTC()) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid token"})
		return
	}

	now := time.Now().UTC()
	dbToken.RevokedAt = &now
	if err := h.DB.Save(&dbToken).Error; err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to refresh"})
		return
	}

	var user models.User
	if err := h.DB.First(&user, dbToken.UserID).Error; err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid token"})
		return
	}

	accessToken, refreshToken, err := h.issueTokens(user.ID, string(user.Role))
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to refresh"})
		return
	}

	uid := user.ID
	h.audit(&uid, "token_refresh", "user", uintToString(user.ID), true, "refresh rotation", clientIP(r))
	writeJSON(w, http.StatusOK, map[string]any{
		"access_token":  accessToken,
		"refresh_token": refreshToken,
		"token_type":    "bearer",
		"expires_in":    int(h.Config.AccessTokenTTL.Seconds()),
	})
}

func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	var req logoutRequest
	_ = decodeJSON(r, &req)

	userID, _ := r.Context().Value(middleware.CtxUserID).(uint)

	jti, _ := r.Context().Value(middleware.CtxJTI).(string)
	exp, _ := r.Context().Value(middleware.CtxEXP).(time.Time)
	if jti != "" && !exp.IsZero() {
		h.TokenDenylist.Add(jti, exp)
	}

	if req.RefreshToken != "" {
		if l := len(strings.TrimSpace(req.RefreshToken)); l >= 32 && l <= 300 {
			hash := security.HashToken(req.RefreshToken)
			now := time.Now().UTC()
			h.DB.Model(&models.RefreshToken{}).
				Where("user_id = ? AND token_hash = ? AND revoked_at IS NULL", userID, hash).
				Update("revoked_at", now)
		}
	}

	h.audit(&userID, "logout", "user", uintToString(userID), true, "user logout", clientIP(r))
	writeJSON(w, http.StatusOK, map[string]string{"message": "logged out"})
}

func (h *Handler) issueTokens(userID uint, role string) (accessToken string, refreshToken string, err error) {
	accessToken, _, err = security.BuildAccessToken(h.Config.JWTSecret, userID, role, h.Config.AccessTokenTTL)
	if err != nil {
		return "", "", err
	}

	rawRefresh, refreshHash, err := security.GenerateRefreshToken()
	if err != nil {
		return "", "", err
	}

	row := models.RefreshToken{
		UserID:    userID,
		TokenHash: refreshHash,
		ExpiresAt: time.Now().UTC().Add(h.Config.RefreshTokenTTL),
	}
	if err := h.DB.Create(&row).Error; err != nil {
		return "", "", err
	}

	return accessToken, rawRefresh, nil
}

func uintToString(v uint) string {
	return strconv.FormatUint(uint64(v), 10)
}
