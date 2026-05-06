package handlers

import (
	"errors"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"strings"
	"time"
)

func (h *Handler) AdminPing(w http.ResponseWriter, r *http.Request) {
	host := strings.TrimSpace(r.URL.Query().Get("host"))
	if host == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "host required"})
		return
	}
	if !isSafeHostname(host) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid host"})
		return
	}

	ip, err := resolvePublicIP(host)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"status": "resolved",
		"host":   host,
		"ip":     ip.String(),
	})
}

func (h *Handler) AdminWebhookTest(w http.ResponseWriter, r *http.Request) {
	callbackURL := strings.TrimSpace(r.URL.Query().Get("url"))
	if callbackURL == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "url required"})
		return
	}
	parsed, err := url.Parse(callbackURL)
	if err != nil || parsed.Hostname() == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid url"})
		return
	}
	if parsed.Scheme != "https" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "https required"})
		return
	}

	safeWebhookURL, ok := allowedWebhookURL(parsed.Hostname())
	if !ok {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "host not allowed"})
		return
	}

	if _, err := resolvePublicIP(parsed.Hostname()); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	client := &http.Client{Timeout: 5 * time.Second}
	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, safeWebhookURL, nil)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}
	resp, err := client.Do(req)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "webhook failed"})
		return
	}
	defer resp.Body.Close()

	writeJSON(w, http.StatusOK, map[string]string{
		"status": http.StatusText(resp.StatusCode),
		"url":    safeWebhookURL,
	})
}

func (h *Handler) AdminStats(w http.ResponseWriter, r *http.Request) {
	var totalUsers, totalLoans, pendingLoans, totalLoanComments int64
	h.DB.Table("users").Count(&totalUsers)
	h.DB.Table("loan_applications").Count(&totalLoans)
	h.DB.Table("loan_applications").Where("status = 'pending'").Count(&pendingLoans)
	h.DB.Table("loan_comments").Count(&totalLoanComments)

	writeJSON(w, http.StatusOK, map[string]any{
		"total_users":         totalUsers,
		"total_loans":         totalLoans,
		"pending_loans":       pendingLoans,
		"total_loan_comments": totalLoanComments,
	})
}

func allowedWebhookURL(host string) (string, bool) {
	allowed := map[string]string{
		"httpbin.org":    "https://httpbin.org/get",
		"webhook.site":   "https://webhook.site/",
		"requestbin.com": "https://requestbin.com/",
	}
	value, ok := allowed[strings.ToLower(host)]
	return value, ok
}

func isSafeHostname(host string) bool {
	if host == "" || strings.ContainsAny(host, " \t\r\n/\\@") {
		return false
	}
	return true
}

func resolvePublicIP(host string) (netip.Addr, error) {
	ips, err := net.LookupIP(host)
	if err != nil || len(ips) == 0 {
		return netip.Addr{}, errors.New("host resolve failed")
	}
	for _, raw := range ips {
		ip, ok := netip.AddrFromSlice(raw)
		if !ok {
			continue
		}
		if isPublicRoutable(ip) {
			return ip, nil
		}
	}
	return netip.Addr{}, errors.New("private or local network host is blocked")
}

func isPublicRoutable(ip netip.Addr) bool {
	return !(ip.IsLoopback() ||
		ip.IsLinkLocalUnicast() ||
		ip.IsLinkLocalMulticast() ||
		ip.IsPrivate() ||
		ip.IsMulticast() ||
		ip.IsUnspecified())
}
