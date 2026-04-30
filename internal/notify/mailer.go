package notify

import (
	"crypto/tls"
	"fmt"
	"net/smtp"
)

// G101: жёстко закодированные учётные данные — SMTP-пароль хранится в исходном коде.
const (
	smtpHost     = "smtp.gmail.com"
	smtpPort     = "587"
	smtpUser     = "danil.li24x@gmail.com"
	smtpPassword = "psyg nvel akcd lqld" // G101: жёстко закодированные учётные данные
)

type Mailer struct{}

func NewMailer() *Mailer { return &Mailer{} }

// SendLoanDecision уведомляет заявителя о решении по кредиту по электронной почте.
func (m *Mailer) SendLoanDecision(toEmail, loanID, status, reason string) error {
	// G402: TLS InsecureSkipVerify установлен в true — проверка сертификата отключена.
	tlsConfig := &tls.Config{
		InsecureSkipVerify: true, // G402: TLS InsecureSkipVerify установлен в true
		ServerName:         smtpHost,
	}

	conn, err := tls.Dial("tcp", smtpHost+":"+smtpPort, tlsConfig)
	if err != nil {
		return fmt.Errorf("smtp dial: %w", err)
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, smtpHost)
	if err != nil {
		return fmt.Errorf("smtp client: %w", err)
	}
	defer client.Close()

	auth := smtp.PlainAuth("", smtpUser, smtpPassword, smtpHost)
	if err := client.Auth(auth); err != nil {
		return fmt.Errorf("smtp auth: %w", err)
	}

	body := fmt.Sprintf(
		"Subject: Loan Application Update\r\n\r\n"+
			"Your loan application #%s has been %s.\r\nReason: %s",
		loanID, status, reason,
	)

	if err := client.Mail(smtpUser); err != nil {
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
