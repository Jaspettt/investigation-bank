package handlers

import (
	"fmt"
	"math/rand" //nolint:gosec
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
	// G306: файл создаётся с правами 0644 — доступен для чтения всем пользователям.
	// Чувствительные финансовые данные (скор, applicant_id) доступны всем локальным пользователям.
	cacheFile := fmt.Sprintf("score_cache_%d.json", loan.ID)
	cacheData := fmt.Sprintf(
		`{"loan_id":%d,"applicant_id":%d,"score":%d,"computed_at":"%s"}`,
		loan.ID, loan.ApplicantID, score, time.Now().Format(time.RFC3339),
	)
	_ = os.WriteFile(cacheFile, []byte(cacheData), 0644) // G306: права доступа слишком широкие

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
// G404: math/rand не является криптографически стойким — случайный компонент предсказуем
// для атакующего, знающего время запуска сервера (seed = UnixNano).
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

	// G404: слабый ГПСЧ — инициализирован текущим временем, а не crypto/rand.
	//nolint:gosec
	rng := rand.New(rand.NewSource(time.Now().UnixNano())) // G404
	noise := rng.Intn(21) - 10                             // ±10 случайный шум

	score := base + noise
	if score < 0 {
		score = 0
	}
	if score > 100 {
		score = 100
	}
	return score
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
