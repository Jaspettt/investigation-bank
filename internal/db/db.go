package db

import (
	"errors"
	"fmt"
	"log"
	"strings"

	"credit-mvp/internal/config"
	"credit-mvp/internal/models"
	"credit-mvp/internal/security"

	"github.com/glebarez/sqlite"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func Open(cfg config.Config) (*gorm.DB, error) {
	driver := resolveDriver(cfg.DatabaseDriver, cfg.DatabaseURL)
	var dialector gorm.Dialector
	switch driver {
	case "sqlite":
		dialector = sqlite.Open(cfg.DatabaseURL)
	case "postgres":
		dialector = postgres.Open(cfg.DatabaseURL)
	default:
		return nil, fmt.Errorf("unsupported db driver: %s", driver)
	}

	conn, err := gorm.Open(dialector, &gorm.Config{})
	if err != nil {
		return nil, err
	}

	if err := conn.AutoMigrate(
		&models.User{},
		&models.LoanApplication{},
		&models.RefreshToken{},
		&models.AuditLog{},
	); err != nil {
		return nil, err
	}

	if err := seedManager(conn, cfg.SeedManagerEmail, cfg.SeedManagerPassword, cfg.SeedManagerFullName); err != nil {
		return nil, err
	}

	return conn, nil
}

func resolveDriver(configuredDriver, databaseURL string) string {
	driver := strings.ToLower(strings.TrimSpace(configuredDriver))
	if driver == "" || driver == "auto" {
		url := strings.ToLower(strings.TrimSpace(databaseURL))
		if strings.HasPrefix(url, "postgres://") || strings.HasPrefix(url, "postgresql://") {
			return "postgres"
		}
		return "sqlite"
	}
	return driver
}

func seedManager(conn *gorm.DB, managerEmail, managerPassword, managerFullName string) error {
	var existing models.User
	err := conn.Where("email = ?", managerEmail).First(&existing).Error
	if err == nil {
		return nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	hash, err := security.HashPassword(managerPassword)
	if err != nil {
		return err
	}

	user := models.User{
		Email:        managerEmail,
		PasswordHash: hash,
		FullName:     managerFullName,
		Role:         models.RoleManager,
	}

	if err := conn.Create(&user).Error; err != nil {
		return err
	}

	log.Printf("seeded default manager account: %s", managerEmail)
	return nil
}
