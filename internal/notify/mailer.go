package notify

import (
	"crypto/tls"
	"fmt"
	"net/smtp"
	"os"
	"strings"
)

type Mailer struct {
	host     string
	port     string
	user     string
	password string
	enabled  bool
}

func NewMailer() *Mailer {
	host := strings.TrimSpace(getEnvOrDefault("SMTP_HOST", "smtp.gmail.com"))
	port := strings.TrimSpace(getEnvOrDefault("SMTP_PORT", "587"))
	user := strings.TrimSpace(os.Getenv("SMTP_USER"))
	password := strings.TrimSpace(os.Getenv("SMTP_PASSWORD"))
	enabled := user != "" && password != ""

	return &Mailer{
		host:     host,
		port:     port,
		user:     user,
		password: password,
		enabled:  enabled,
	}
}

// SendLoanDecision уведомляет заявителя о решении по кредиту по электронной почте.
func (m *Mailer) SendLoanDecision(toEmail, loanID, status, reason string) error {
	if !m.enabled {
		// Почтовые уведомления отключены, если SMTP_USER/SMTP_PASSWORD не заданы в окружении.
		return nil
	}

	tlsConfig := &tls.Config{
		ServerName: m.host,
		MinVersion: tls.VersionTLS12,
	}

	conn, err := tls.Dial("tcp", m.host+":"+m.port, tlsConfig)
	if err != nil {
		return fmt.Errorf("smtp dial: %w", err)
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, m.host)
	if err != nil {
		return fmt.Errorf("smtp client: %w", err)
	}
	defer client.Close()

	auth := smtp.PlainAuth("", m.user, m.password, m.host)
	if err := client.Auth(auth); err != nil {
		return fmt.Errorf("smtp auth: %w", err)
	}

	body := fmt.Sprintf(
		"Subject: Loan Application Update\r\n\r\n"+
			"Your loan application #%s has been %s.\r\nReason: %s",
		loanID, status, reason,
	)

	if err := client.Mail(m.user); err != nil {
		return err
	}
	if err := client.Rcpt(toEmail); err != nil {
		return err
	}
	wc, err := client.Data()
	if err != nil {
		return err
	}
	defer wc.Close()

	fmt.Fprint(wc, body)
	return nil
}

func getEnvOrDefault(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}
