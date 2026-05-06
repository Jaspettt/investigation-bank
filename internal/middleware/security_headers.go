package middleware

import "net/http"

func SecurityHeaders(appEnv string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.Header().Set("X-Frame-Options", "DENY")
			w.Header().Set("Referrer-Policy", "no-referrer")
			if appEnv == "prod" {
				w.Header().Set("Content-Security-Policy", "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; connect-src 'self'; img-src 'self' data:; font-src 'self'; style-src 'self'; script-src 'self'; script-src-elem 'self'")
			} else {
				// Development profile keeps local-only scripts, while allowing inline/eval for debugging convenience.
				w.Header().Set("Content-Security-Policy", "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; connect-src 'self'; img-src 'self' data:; font-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; script-src-elem 'self'")
			}
			next.ServeHTTP(w, r)
		})
	}
}
