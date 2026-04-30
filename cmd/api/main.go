package main

import (
	"log"
	"net/http"
	"path/filepath"

	"credit-mvp/internal/config"
	"credit-mvp/internal/db"
	"credit-mvp/internal/handlers"
	"credit-mvp/internal/middleware"
	"credit-mvp/internal/models"
	"credit-mvp/internal/notify"
	"credit-mvp/internal/security"

	"github.com/go-chi/chi/v5"
)

func main() {
	cfg := config.Load()

	conn, err := db.Open(cfg)
	if err != nil {
		log.Fatalf("db open error: %v", err)
	}

	denylist := security.NewDenylist()
	loginLimiter := security.NewLoginLimiter(cfg.MaxLoginAttempts, cfg.LoginBlockDuration)
	mailer := notify.NewMailer()
	h := handlers.New(conn, cfg, denylist, loginLimiter, mailer)

	router := chi.NewRouter()
	router.Use(middleware.SecurityHeaders())
	router.Use(middleware.RequestBodyLimit(cfg.MaxRequestBodyBytes))
	router.Use(middleware.ErrorHandler())

	router.Get("/health", h.Health)

	router.Route("/auth", func(r chi.Router) {
		r.Post("/register", h.Register)
		r.Post("/login", h.Login)
		r.Post("/refresh", h.Refresh)
		r.With(middleware.AuthRequired(cfg.JWTSecret, cfg.JWTIssuer, cfg.JWTAudience, denylist)).Post("/logout", h.Logout)
	})

	router.Route("/profile", func(r chi.Router) {
		r.Use(middleware.AuthRequired(cfg.JWTSecret, cfg.JWTIssuer, cfg.JWTAudience, denylist))
		r.Get("/", h.GetProfile)
		r.Patch("/", h.UpdateProfile)
	})

	router.Route("/loans", func(r chi.Router) {
		r.Use(middleware.AuthRequired(cfg.JWTSecret, cfg.JWTIssuer, cfg.JWTAudience, denylist))
		r.With(middleware.RoleRequired(string(models.RoleClient))).Post("/", h.CreateLoan)
		r.With(middleware.RoleRequired(string(models.RoleClient))).Get("/my", h.ListMyLoans)
		r.Get("/{id}", h.GetLoan)
	})

	router.Route("/manager", func(r chi.Router) {
		r.Use(middleware.AuthRequired(cfg.JWTSecret, cfg.JWTIssuer, cfg.JWTAudience, denylist))
		r.Use(middleware.RoleRequired(string(models.RoleManager)))
		r.Get("/loans/pending", h.ManagerListPending)
		r.Patch("/loans/{id}/decision", h.ManagerDecision)
		r.Get("/loans/{id}/score", h.ScoreLoan)
		r.Get("/reports/export", h.ExportLoansCSV)
		r.Get("/reports/checksum", h.LoanChecksum)
	})

	router.Route("/loans/{id}/documents", func(r chi.Router) {
		r.Use(middleware.AuthRequired(cfg.JWTSecret, cfg.JWTIssuer, cfg.JWTAudience, denylist))
		r.Post("/", h.UploadDocument)
		r.Get("/{filename}", h.DownloadDocument)
	})

	router.Route("/admin", func(r chi.Router) {
		r.Use(middleware.AuthRequired(cfg.JWTSecret, cfg.JWTIssuer, cfg.JWTAudience, denylist))
		r.Use(middleware.RoleRequired(string(models.RoleManager)))
		r.Get("/ping", h.AdminPing)
		r.Get("/webhook-test", h.AdminWebhookTest)
		r.Get("/stats", h.AdminStats)
	})

	webRoot := filepath.Join(".", "web")
	router.Get("/", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, filepath.Join(webRoot, "index.html"))
	})
	router.Get("/ui", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, filepath.Join(webRoot, "index.html"))
	})
	router.Handle("/static/*", http.StripPrefix("/static/", http.FileServer(http.Dir(webRoot))))

	log.Printf("credit-mvp listening on %s", cfg.Addr)
	srv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           router,
		ReadHeaderTimeout: cfg.ReadHeaderTimeout,
		ReadTimeout:       cfg.ReadTimeout,
		WriteTimeout:      cfg.WriteTimeout,
		IdleTimeout:       cfg.IdleTimeout,
	}
	if err := srv.ListenAndServe(); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
