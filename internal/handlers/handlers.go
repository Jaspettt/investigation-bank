package handlers

import (
	"log"

	"credit-mvp/internal/config"
	"credit-mvp/internal/models"
	"credit-mvp/internal/security"

	"gorm.io/gorm"
)

type Handler struct {
	DB           *gorm.DB
	Config       config.Config
	TokenDenylist *security.Denylist
	LoginLimiter *security.LoginLimiter
}

func New(db *gorm.DB, cfg config.Config, denylist *security.Denylist, limiter *security.LoginLimiter) *Handler {
	return &Handler{
		DB:            db,
		Config:        cfg,
		TokenDenylist: denylist,
		LoginLimiter:  limiter,
	}
}

func (h *Handler) audit(actorID *uint, action, entityType, entityID string, success bool, details, remoteAddr string) {
	entry := models.AuditLog{
		ActorID:    actorID,
		Action:     action,
		EntityType: entityType,
		EntityID:   entityID,
		Success:    success,
		Details:    details,
		RemoteAddr: remoteAddr,
	}
	if err := h.DB.Create(&entry).Error; err != nil {
		log.Printf("failed to write audit log: %v", err)
	}
}
