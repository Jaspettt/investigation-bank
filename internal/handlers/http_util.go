package handlers

import (
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"net/mail"
)

func decodeJSON(r *http.Request, dst any) error {
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		return err
	}
	var extra any
	if err := dec.Decode(&extra); err != io.EOF {
		return errors.New("unexpected extra JSON tokens")
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func isValidEmail(v string) bool {
	if len(v) > 254 {
		return false
	}
	_, err := mail.ParseAddress(v)
	return err == nil
}

// clientIP возвращает только сетевой адрес удалённой стороны.
// Заголовок X-Forwarded-For намеренно не доверяется: атакующий может установить
// произвольное значение и обойти ограничитель попыток входа по IP (CWE-290).
// При развёртывании за доверенным обратным прокси используйте специализированный
// middleware (например, chi-realip), который проверяет источник прокси
// перед извлечением переданного адреса.
func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
