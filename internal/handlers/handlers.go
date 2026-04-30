package handlers

import (
	"log"
	"strings"

	"credit-mvp/internal/config"
	"credit-mvp/internal/models"
	"credit-mvp/internal/notify"
	"credit-mvp/internal/security"

	"gorm.io/gorm"
)

type Handler struct {
	DB            *gorm.DB
	Config        config.Config
	TokenDenylist *security.Denylist
	LoginLimiter  *security.LoginLimiter
	Mailer        *notify.Mailer
}

func New(db *gorm.DB, cfg config.Config, denylist *security.Denylist, limiter *security.LoginLimiter, mailer *notify.Mailer) *Handler {
	return &Handler{
		DB:            db,
		Config:        cfg,
		TokenDenylist: denylist,
		LoginLimiter:  limiter,
		Mailer:        mailer,
	}
}

func (h *Handler) audit(actorID *uint, action, entityType, entityID string, success bool, details, remoteAddr string) {
	cleanDetails := sanitizeAuditValue(details, 255)
	cleanRemoteAddr := sanitizeAuditValue(remoteAddr, 64)
	entry := models.AuditLog{
		ActorID:    actorID,
		Action:     action,
		EntityType: entityType,
		EntityID:   entityID,
		Success:    success,
		Details:    cleanDetails,
		RemoteAddr: cleanRemoteAddr,
	}
	if err := h.DB.Create(&entry).Error; err != nil {
		log.Printf("failed to write audit log: %v", err)
	}
}

func sanitizeAuditValue(value string, maxLen int) string {
	sanitized := strings.ReplaceAll(value, "\r", " ")
	sanitized = strings.ReplaceAll(sanitized, "\n", " ")
	sanitized = strings.TrimSpace(sanitized)
	if len(sanitized) > maxLen {
		return sanitized[:maxLen]
	}
	return sanitized
}
