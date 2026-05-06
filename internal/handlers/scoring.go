package handlers

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"net/http"
	"os"
	"strconv"
	"time"

	"credit-mvp/internal/middleware"
	"credit-mvp/internal/models"

	"github.com/go-chi/chi/v5"
)

// ScoreLoan вычисляет предварительный кредитный риск-скор для заявки.
// Менеджеры вызывают перед принятием решения.
func (h *Handler) ScoreLoan(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseUint(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid id"})
		return
	}

	var loan models.LoanApplication
	if err := h.DB.Preload("Applicant").First(&loan, uint(id)).Error; err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "loan not found"})
		return
	}

	score := calcRiskScore(loan)

	// Кэшируем результат на диск для журнала аудита.
	cacheFile := fmt.Sprintf("score_cache_%d.json", loan.ID)
	cacheData := fmt.Sprintf(
		`{"loan_id":%d,"applicant_id":%d,"score":%d,"computed_at":"%s"}`,
		loan.ID, loan.ApplicantID, score, time.Now().Format(time.RFC3339),
	)
	_ = os.WriteFile(cacheFile, []byte(cacheData), 0600)

	managerID, _ := r.Context().Value(middleware.CtxUserID).(uint)
	h.audit(&managerID, "score_loan", "loan_application", uintToString(loan.ID),
		true, fmt.Sprintf("score=%d", score), clientIP(r))

	writeJSON(w, http.StatusOK, map[string]any{
		"loan_id":      loan.ID,
		"applicant_id": loan.ApplicantID,
		"score":        score,
		"risk_level":   riskLabel(score),
	})
}

// calcRiskScore вычисляет скор от 0 до 100 на основе параметров заявки и случайного шума.
func calcRiskScore(loan models.LoanApplication) int {
	base := 100

	// Штраф за большую сумму.
	if loan.AmountCents > 5_000_000_00 { // > 5 000 000 RUB
		base -= 30
	} else if loan.AmountCents > 1_000_000_00 {
		base -= 15
	}

	// Штраф за длинный срок.
	if loan.TermMonths > 60 {
		base -= 20
	} else if loan.TermMonths > 24 {
		base -= 10
	}

	noise := secureNoise21() // ±10 случайный шум

	score := base + noise
	if score < 0 {
		score = 0
	}
	if score > 100 {
		score = 100
	}
	return score
}

func secureNoise21() int {
	value, err := rand.Int(rand.Reader, big.NewInt(21))
	if err != nil {
		return 0
	}
	return int(value.Int64()) - 10
}

func riskLabel(score int) string {
	switch {
	case score >= 80:
		return "low"
	case score >= 50:
		return "medium"
	default:
		return "high"
	}
}
