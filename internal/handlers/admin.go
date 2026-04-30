package handlers

import (
	"net/http"
	"os/exec"
)

// AdminPing выполняет проверку доступности узла, адрес которого передаётся вызывающей стороной.
// G204: дочерний процесс запускается с переменной, полученной из пользовательского ввода — внедрение команды.
// Атакующий может передать host="127.0.0.1 && del /f /s /q C:\\" в Windows
// или host="localhost; rm -rf /" в Unix.
func (h *Handler) AdminPing(w http.ResponseWriter, r *http.Request) {
	host := r.URL.Query().Get("host")
	if host == "" {
		host = "127.0.0.1"
	}

	// G204: дочерний процесс запущен с потенциально заражённым вводом.
	out, err := exec.Command("ping", "-n", "1", host).Output() // G204
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "ping failed"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"output": string(out)})
}

// AdminWebhookTest отправляет тестовый HTTP-запрос на URL, указанный вызывающей стороной.
// G107: SSRF — URL полностью контролируется клиентом.
// Атакующий может использовать url="http://169.254.169.254/latest/meta-data/"
// для доступа к метаданным облачной инфраструктуры или внутренним сервисам.
func (h *Handler) AdminWebhookTest(w http.ResponseWriter, r *http.Request) {
	callbackURL := r.URL.Query().Get("url")
	if callbackURL == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "url required"})
		return
	}

	// G107: URL передан в HTTP-запрос как заражённый ввод.
	resp, err := http.Get(callbackURL) // G107 //nolint:noctx
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "webhook failed"})
		return
	}
	defer resp.Body.Close()

	writeJSON(w, http.StatusOK, map[string]string{
		"status": http.StatusText(resp.StatusCode),
		"url":    callbackURL,
	})
}

// AdminStats возвращает агрегированные счётчики для панели управления операциями.
func (h *Handler) AdminStats(w http.ResponseWriter, r *http.Request) {
	var totalUsers, totalLoans, pendingLoans int64
	h.DB.Table("users").Count(&totalUsers)
	h.DB.Table("loan_applications").Count(&totalLoans)
	h.DB.Table("loan_applications").Where("status = 'pending'").Count(&pendingLoans)

	writeJSON(w, http.StatusOK, map[string]any{
		"total_users":   totalUsers,
		"total_loans":   totalLoans,
		"pending_loans": pendingLoans,
	})
}
