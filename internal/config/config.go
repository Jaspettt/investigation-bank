package config

import (
	"log"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	AppEnv               string
	Addr                 string
	DatabaseDriver       string
	DatabaseURL          string
	SeedManagerEmail     string
	SeedManagerPassword  string
	SeedManagerFullName  string
	JWTSecret            string
	ReadHeaderTimeout    time.Duration
	ReadTimeout          time.Duration
	WriteTimeout         time.Duration
	IdleTimeout          time.Duration
	AccessTokenTTL       time.Duration
	RefreshTokenTTL      time.Duration
	MaxRequestBodyBytes  int64
	MaxLoginAttempts     int
	LoginBlockDuration   time.Duration
	ManagerDecisionScope string
}

func Load() Config {
	_ = godotenv.Load()

	cfg := Config{
		AppEnv:               getOrDefault("APP_ENV", "dev"),
		Addr:                 getOrDefault("ADDR", ":8080"),
		DatabaseDriver:       getOrDefault("DB_DRIVER", "auto"),
		DatabaseURL:          getOrDefault("DATABASE_URL", "file:credit_mvp.db?_foreign_keys=on"),
		SeedManagerEmail:     getOrDefault("SEED_MANAGER_EMAIL", "manager@bank.local"),
		SeedManagerPassword:  getRequired("SEED_MANAGER_PASSWORD"),
		SeedManagerFullName:  getOrDefault("SEED_MANAGER_FULL_NAME", "Default Manager"),
		JWTSecret:            getRequired("JWT_SECRET"),
		ReadHeaderTimeout:    getDuration("READ_HEADER_TIMEOUT", 5*time.Second),
		ReadTimeout:          getDuration("READ_TIMEOUT", 10*time.Second),
		WriteTimeout:         getDuration("WRITE_TIMEOUT", 15*time.Second),
		IdleTimeout:          getDuration("IDLE_TIMEOUT", 30*time.Second),
		AccessTokenTTL:       getDuration("ACCESS_TOKEN_TTL", 15*time.Minute),
		RefreshTokenTTL:      getDuration("REFRESH_TOKEN_TTL", 24*time.Hour),
		MaxRequestBodyBytes:  getInt64("MAX_REQUEST_BODY_BYTES", 1<<20), // 1MB for MVP
		MaxLoginAttempts:     getInt("MAX_LOGIN_ATTEMPTS", 5),
		LoginBlockDuration:   getDuration("LOGIN_BLOCK_DURATION", 15*time.Minute),
		ManagerDecisionScope: getOrDefault("MANAGER_DECISION_SCOPE", "all"),
	}

	return cfg
}

func getRequired(key string) string {
	value := os.Getenv(key)
	if value == "" {
		log.Fatalf("required env var is missing: %s", key)
	}
	return value
}

func getOrDefault(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func getDuration(key string, fallback time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		parsed, err := time.ParseDuration(value)
		if err != nil {
			log.Fatalf("invalid duration for %s: %v", key, err)
		}
		return parsed
	}
	return fallback
}

func getInt(key string, fallback int) int {
	if value := os.Getenv(key); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil {
			log.Fatalf("invalid integer for %s: %v", key, err)
		}
		return parsed
	}
	return fallback
}

func getInt64(key string, fallback int64) int64 {
	if value := os.Getenv(key); value != "" {
		parsed, err := strconv.ParseInt(value, 10, 64)
		if err != nil {
			log.Fatalf("invalid int64 for %s: %v", key, err)
		}
		return parsed
	}
	return fallback
}
