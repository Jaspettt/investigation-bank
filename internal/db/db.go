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
		&models.LoanComment{},
		&models.RefreshToken{},
		&models.AuditLog{},
	); err != nil {
		return nil, err
	}

	if err := seedManager(conn, cfg.SeedManagerEmail, cfg.SeedManagerPassword, cfg.SeedManagerFullName); err != nil {
		return nil, err
	}
	if err := seedInitialDataset(conn, cfg.AppEnv); err != nil {
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

func seedInitialDataset(conn *gorm.DB, appEnv string) error {
	if strings.EqualFold(appEnv, "test") {
		return nil
	}

	const targetClientRows = 200
	const targetLoanRows = 250
	const targetCommentRows = 200

	hash, err := security.HashPassword("Client12345!")
	if err != nil {
		return err
	}

	firstNames := []string{
		"Aleksei", "Maria", "Dmitriy", "Elena", "Sergey", "Anastasia", "Pavel", "Irina", "Anton", "Olga",
		"Roman", "Svetlana", "Andrey", "Tatiana", "Nikita", "Yulia", "Viktor", "Natalia", "Maksim", "Alina",
		"Kirill", "Ekaterina", "Denis", "Polina", "Igor", "Artem", "Valeria", "Oleg", "Kristina", "Mikhail",
		"Vera", "Stepan", "Lidia", "Timur", "Larisa", "Yegor", "Ksenia", "Vladislav", "Inna", "Rinat",
	}
	lastNames := []string{
		"Ivanov", "Petrova", "Sokolov", "Smirnova", "Volkov", "Morozova", "Kuznetsov", "Popova", "Vasiliev", "Lebedeva",
		"Kozlov", "Novikova", "Fedorov", "Mikhailova", "Pavlov", "Semenova", "Egorov", "Vinogradova", "Bogdanov", "Voronina",
		"Belov", "Titova", "Nikitin", "Zaitseva", "Filippov", "Orlov", "Danilova", "Safonov", "Karpova", "Gromov",
		"Kulikova", "Borisov", "Alexeeva", "Mironov", "Belyaeva", "Rybakov", "Tarasova", "Makarov", "Sorokina", "Akhmetov",
	}
	clients := make([]models.User, 0, targetClientRows)
	for i := 1; i <= targetClientRows; i++ {
		email := fmt.Sprintf("client%03d@bank.local", i)
		fullName := fmt.Sprintf("%s %s", firstNames[(i-1)%len(firstNames)], lastNames[(i-1)%len(lastNames)])

		var user models.User
		err := conn.Where("email = ?", email).First(&user).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			user = models.User{
				Email:        email,
				PasswordHash: hash,
				FullName:     fullName,
				Role:         models.RoleClient,
			}
			if err := conn.Create(&user).Error; err != nil {
				return err
			}
		} else if err != nil {
			return err
		}
		clients = append(clients, user)
	}
	log.Printf("seeded baseline clients: target=%d", targetClientRows)

	var manager models.User
	if err := conn.Where("role = ?", models.RoleManager).First(&manager).Error; err != nil {
		return err
	}

	var existingLoans int64
	if err := conn.Model(&models.LoanApplication{}).Count(&existingLoans).Error; err != nil {
		return err
	}

	purposes := []string{
		"Home renovation and interior upgrades",
		"Used car purchase for family needs",
		"Medical treatment and diagnostics",
		"Small business working capital",
		"Education tuition and certification",
		"Energy-efficient home improvements",
		"Debt consolidation from multiple lenders",
		"Family travel and relocation expenses",
		"Laptop and equipment for remote work",
		"Emergency reserve and urgent repairs",
		"Furniture and appliance replacement",
		"Professional training and retraining",
		"Dental care and planned surgery",
		"Wedding and family event expenses",
		"Children school and extracurricular fees",
	}
	currencies := []string{"RUB", "USD", "EUR"}

	if existingLoans < targetLoanRows {
		toCreate := int(targetLoanRows - existingLoans)
		for i := 0; i < toCreate; i++ {
			client := clients[i%len(clients)]
			currency := currencies[i%len(currencies)]
			status := models.LoanPending
			switch i % 10 {
			case 0, 3, 7:
				status = models.LoanApproved
			case 1, 6:
				status = models.LoanRejected
			}

			loan := models.LoanApplication{
				ApplicantID: client.ID,
				AmountCents: int64(180_000_00 + (i%90)*15_000_00),
				Currency:    currency,
				TermMonths:  6 + (i % 54),
				Purpose:     purposes[i%len(purposes)],
				Status:      status,
			}
			if status != models.LoanPending {
				loan.DecidedByID = &manager.ID
				reason := "automatic seeded decision for initial dataset"
				loan.DecisionReason = &reason
			}

			if err := conn.Create(&loan).Error; err != nil {
				return err
			}
		}
		log.Printf("seeded initial dataset: %d additional loan rows", toCreate)
	} else {
		log.Printf("seeded initial dataset: loan rows already >= %d", targetLoanRows)
	}

	var loans []models.LoanApplication
	if err := conn.Select("id", "applicant_id").Order("id asc").Find(&loans).Error; err != nil {
		return err
	}
	if len(loans) == 0 {
		return errors.New("cannot seed comments without loans")
	}

	var existingComments int64
	if err := conn.Model(&models.LoanComment{}).Count(&existingComments).Error; err != nil {
		return err
	}
	if existingComments < targetCommentRows {
		commentCategories := []string{"review", "risk", "verification", "follow_up"}
		commentTemplates := []string{
			"Income documents validated and linked to this application.",
			"Client requested a callback window for additional clarifications.",
			"Risk indicators reviewed; no critical anomalies detected.",
			"Payment history cross-check completed successfully.",
			"Manual note for branch manager follow-up before final decision.",
		}
		toCreate := int(targetCommentRows - existingComments)
		for i := 0; i < toCreate; i++ {
			loan := loans[i%len(loans)]
			authorID := manager.ID
			if i%3 == 0 {
				authorID = loan.ApplicantID
			}

			comment := models.LoanComment{
				LoanID:     loan.ID,
				AuthorID:   authorID,
				Category:   commentCategories[i%len(commentCategories)],
				Body:       commentTemplates[i%len(commentTemplates)],
				IsInternal: i%5 != 0,
			}

			if err := conn.Create(&comment).Error; err != nil {
				return err
			}
		}
		log.Printf("seeded initial dataset: %d additional loan comment rows", toCreate)
	} else {
		log.Printf("seeded initial dataset: loan comment rows already >= %d", targetCommentRows)
	}
	return nil
}
