package integration

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"credit-mvp/internal/config"
	"credit-mvp/internal/db"
	"credit-mvp/internal/handlers"
	"credit-mvp/internal/middleware"
	"credit-mvp/internal/models"
	"credit-mvp/internal/notify"
	"credit-mvp/internal/security"

	"github.com/go-chi/chi/v5"
)

func TestClientCannotAccessAnotherLoan(t *testing.T) {
	srv := newTestServer(t)

	registerUser(t, srv, "alice@example.com", "Alice12345!", "Alice")
	aliceTokens := loginUser(t, srv, "alice@example.com", "Alice12345!")
	loanID := createLoan(t, srv, aliceTokens.AccessToken)

	registerUser(t, srv, "bob@example.com", "Bob1234567!", "Bob")
	bobTokens := loginUser(t, srv, "bob@example.com", "Bob1234567!")

	rec := doJSON(t, srv, http.MethodGet, fmt.Sprintf("/loans/%d", loanID), nil, bobTokens.AccessToken)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestClientCannotUseManagerEndpoint(t *testing.T) {
	srv := newTestServer(t)

	registerUser(t, srv, "carol@example.com", "Carol12345!", "Carol")
	clientTokens := loginUser(t, srv, "carol@example.com", "Carol12345!")
	loanID := createLoan(t, srv, clientTokens.AccessToken)

	body := map[string]string{"status": "approved", "reason": "Should be forbidden"}
	rec := doJSON(t, srv, http.MethodPatch, fmt.Sprintf("/manager/loans/%d/decision", loanID), body, clientTokens.AccessToken)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestManagerCanDecidePendingLoan(t *testing.T) {
	srv := newTestServer(t)

	registerUser(t, srv, "dave@example.com", "Dave1234567!", "Dave")
	clientTokens := loginUser(t, srv, "dave@example.com", "Dave1234567!")
	loanID := createLoan(t, srv, clientTokens.AccessToken)

	managerTokens := loginUser(t, srv, "manager@bank.local", "Manager123!")
	body := map[string]string{"status": "approved", "reason": "Income verified"}
	rec := doJSON(t, srv, http.MethodPatch, fmt.Sprintf("/manager/loans/%d/decision", loanID), body, managerTokens.AccessToken)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}

	var payload map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}
	if payload["status"] != string(models.LoanApproved) {
		t.Fatalf("expected status approved, got %v", payload["status"])
	}
}

type testServer struct {
	handler http.Handler
}

type tokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}

func newTestServer(t *testing.T) *testServer {
	t.Helper()
	cfg := config.Config{
		AppEnv:               "test",
		Addr:                 ":0",
		DatabaseDriver:       "sqlite",
		DatabaseURL:          fmt.Sprintf("file:test_%d.db?mode=memory&cache=shared&_foreign_keys=on", time.Now().UnixNano()),
		SeedManagerEmail:     "manager@bank.local",
		SeedManagerPassword:  "Manager123!",
		SeedManagerFullName:  "Default Manager",
		JWTSecret:            "test-secret-123",
		JWTIssuer:            "credit-mvp-test",
		JWTAudience:          "credit-mvp-test-api",
		AccessTokenTTL:       15 * time.Minute,
		RefreshTokenTTL:      24 * time.Hour,
		MaxRequestBodyBytes:  1 << 20,
		MaxLoginAttempts:     5,
		LoginBlockDuration:   15 * time.Minute,
		ManagerDecisionScope: "all",
	}

	conn, err := db.Open(cfg)
	if err != nil {
		t.Fatalf("db open failed: %v", err)
	}

	denylist := security.NewDenylist()
	loginLimiter := security.NewLoginLimiter(cfg.MaxLoginAttempts, cfg.LoginBlockDuration)
	mailer := notify.NewMailer()
	h := handlers.New(conn, cfg, denylist, loginLimiter, mailer)

	r := chi.NewRouter()
	r.Use(middleware.SecurityHeaders(cfg.AppEnv))
	r.Use(middleware.RequestBodyLimit(cfg.MaxRequestBodyBytes))
	r.Use(middleware.ErrorHandler())
	r.Route("/auth", func(sr chi.Router) {
		sr.Post("/register", h.Register)
		sr.Post("/login", h.Login)
		sr.Post("/refresh", h.Refresh)
		sr.With(middleware.AuthRequired(cfg.JWTSecret, cfg.JWTIssuer, cfg.JWTAudience, denylist)).Post("/logout", h.Logout)
	})
	r.Route("/loans", func(sr chi.Router) {
		sr.Use(middleware.AuthRequired(cfg.JWTSecret, cfg.JWTIssuer, cfg.JWTAudience, denylist))
		sr.With(middleware.RoleRequired(string(models.RoleClient))).Post("/", h.CreateLoan)
		sr.With(middleware.RoleRequired(string(models.RoleClient))).Get("/my", h.ListMyLoans)
		sr.Get("/{id}", h.GetLoan)
	})
	r.Route("/manager", func(sr chi.Router) {
		sr.Use(middleware.AuthRequired(cfg.JWTSecret, cfg.JWTIssuer, cfg.JWTAudience, denylist))
		sr.Use(middleware.RoleRequired(string(models.RoleManager)))
		sr.Get("/loans/pending", h.ManagerListPending)
		sr.Patch("/loans/{id}/decision", h.ManagerDecision)
	})

	return &testServer{handler: r}
}

func registerUser(t *testing.T, srv *testServer, email, password, fullName string) {
	t.Helper()
	rec := doJSON(t, srv, http.MethodPost, "/auth/register", map[string]string{
		"email":     email,
		"password":  password,
		"full_name": fullName,
	}, "")
	if rec.Code != http.StatusCreated {
		t.Fatalf("register failed: code=%d body=%s", rec.Code, rec.Body.String())
	}
}

func loginUser(t *testing.T, srv *testServer, email, password string) tokenResponse {
	t.Helper()
	rec := doJSON(t, srv, http.MethodPost, "/auth/login", map[string]string{
		"email":    email,
		"password": password,
	}, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("login failed: code=%d body=%s", rec.Code, rec.Body.String())
	}
	var tokens tokenResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &tokens); err != nil {
		t.Fatalf("parse login response failed: %v", err)
	}
	if tokens.AccessToken == "" || tokens.RefreshToken == "" {
		t.Fatalf("tokens are empty")
	}
	return tokens
}

func createLoan(t *testing.T, srv *testServer, accessToken string) int {
	t.Helper()
	rec := doJSON(t, srv, http.MethodPost, "/loans/", map[string]any{
		"amount_cents": 1500000,
		"currency":     "USD",
		"term_months":  24,
		"purpose":      "Home repair",
	}, accessToken)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create loan failed: code=%d body=%s", rec.Code, rec.Body.String())
	}
	var payload map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("parse loan response failed: %v", err)
	}
	idFloat, ok := payload["id"].(float64)
	if !ok || idFloat < 1 {
		t.Fatalf("invalid loan id in response: %v", payload["id"])
	}
	return int(idFloat)
}

func doJSON(t *testing.T, srv *testServer, method, path string, body any, accessToken string) *httptest.ResponseRecorder {
	t.Helper()
	var payload []byte
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal failed: %v", err)
		}
		payload = raw
	}
	req := httptest.NewRequest(method, path, bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	if accessToken != "" {
		req.Header.Set("Authorization", "Bearer "+accessToken)
	}
	rec := httptest.NewRecorder()
	srv.handler.ServeHTTP(rec, req)
	return rec
}
