package models

import (
	"time"
)

type Role string

const (
	RoleClient  Role = "client"
	RoleManager Role = "manager"
)

type LoanStatus string

const (
	LoanPending  LoanStatus = "pending"
	LoanApproved LoanStatus = "approved"
	LoanRejected LoanStatus = "rejected"
)

type User struct {
	ID           uint      `gorm:"primaryKey"`
	CreatedAt    time.Time `gorm:"index"`
	UpdatedAt    time.Time
	Email        string `gorm:"uniqueIndex;size:254;not null"`
	PasswordHash string `gorm:"size:255;not null"`
	FullName     string `gorm:"size:120;not null"`
	Role         Role   `gorm:"type:text;not null"`
}

type LoanApplication struct {
	ID             uint      `gorm:"primaryKey"`
	CreatedAt      time.Time `gorm:"index"`
	UpdatedAt      time.Time
	ApplicantID    uint       `gorm:"index;not null"`
	Applicant      User       `gorm:"foreignKey:ApplicantID"`
	AmountCents    int64      `gorm:"not null"`
	Currency       string     `gorm:"size:3;not null"`
	TermMonths     int        `gorm:"not null"`
	Purpose        string     `gorm:"size:500;not null"`
	Status         LoanStatus `gorm:"type:text;not null;index"`
	DecisionReason *string    `gorm:"size:500"`
	DecidedByID    *uint
	DecidedBy      *User `gorm:"foreignKey:DecidedByID"`
}

type LoanComment struct {
	ID         uint      `gorm:"primaryKey"`
	CreatedAt  time.Time `gorm:"index"`
	UpdatedAt  time.Time
	LoanID     uint            `gorm:"index;not null"`
	Loan       LoanApplication `gorm:"foreignKey:LoanID"`
	AuthorID   uint            `gorm:"index;not null"`
	Author     User            `gorm:"foreignKey:AuthorID"`
	Category   string          `gorm:"size:32;not null;index"`
	Body       string          `gorm:"size:500;not null"`
	IsInternal bool            `gorm:"not null;default:true"`
}

type RefreshToken struct {
	ID        uint      `gorm:"primaryKey"`
	CreatedAt time.Time `gorm:"index"`
	UpdatedAt time.Time
	UserID    uint      `gorm:"index;not null"`
	TokenHash string    `gorm:"uniqueIndex;size:128;not null"`
	ExpiresAt time.Time `gorm:"index;not null"`
	RevokedAt *time.Time
}

type AuditLog struct {
	ID         uint      `gorm:"primaryKey"`
	CreatedAt  time.Time `gorm:"index"`
	ActorID    *uint     `gorm:"index"`
	Action     string    `gorm:"size:80;not null;index"`
	EntityType string    `gorm:"size:40;not null"`
	EntityID   string    `gorm:"size:40;not null"`
	Success    bool      `gorm:"not null"`
	Details    string    `gorm:"size:255;not null"`
	RemoteAddr string    `gorm:"size:64;not null"`
}
