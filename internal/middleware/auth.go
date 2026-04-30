package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"credit-mvp/internal/security"
)

type ctxKey string

const (
	CtxUserID ctxKey = "auth_user_id"
	CtxRole   ctxKey = "auth_role"
	CtxJTI    ctxKey = "auth_jti"
	CtxEXP    ctxKey = "auth_exp"
)

func AuthRequired(jwtSecret, jwtIssuer, jwtAudience string, denylist *security.Denylist) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			h := r.Header.Get("Authorization")
			if h == "" || !strings.HasPrefix(h, "Bearer ") {
				writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
				return
			}

			raw := strings.TrimPrefix(h, "Bearer ")
			claims, err := security.ParseAccessToken(jwtSecret, jwtIssuer, jwtAudience, raw)
			if err != nil {
				writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
				return
			}

			if denylist.Contains(claims.ID) {
				writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "token revoked"})
				return
			}

			userID, err := strconv.ParseUint(claims.Subject, 10, 64)
			if err != nil {
				writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
				return
			}

			ctx := context.WithValue(r.Context(), CtxUserID, uint(userID))
			ctx = context.WithValue(ctx, CtxRole, claims.Role)
			ctx = context.WithValue(ctx, CtxJTI, claims.ID)
			if claims.ExpiresAt != nil {
				ctx = context.WithValue(ctx, CtxEXP, claims.ExpiresAt.Time)
			}
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func RoleRequired(roles ...string) func(http.Handler) http.Handler {
	allowed := make(map[string]struct{}, len(roles))
	for _, r := range roles {
		allowed[r] = struct{}{}
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			role, _ := r.Context().Value(CtxRole).(string)
			if _, ok := allowed[role]; !ok {
				writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func writeJSON(w http.ResponseWriter, status int, body map[string]string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
