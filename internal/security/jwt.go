package security

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type AccessClaims struct {
	Role string `json:"role"`
	jwt.RegisteredClaims
}

func BuildAccessToken(secret, issuer, audience string, userID uint, role string, ttl time.Duration) (string, string, error) {
	now := time.Now().UTC()
	jtiRaw, err := randomToken(32)
	if err != nil {
		return "", "", err
	}

	claims := AccessClaims{
		Role: role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   uintToString(userID),
			Issuer:    issuer,
			Audience:  jwt.ClaimStrings{audience},
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
			ID:        jtiRaw,
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		return "", "", err
	}
	return signed, jtiRaw, nil
}

func ParseAccessToken(secret, issuer, audience, rawToken string) (*AccessClaims, error) {
	token, err := jwt.ParseWithClaims(rawToken, &AccessClaims{}, func(token *jwt.Token) (interface{}, error) {
		if token.Method.Alg() != jwt.SigningMethodHS256.Alg() {
			return nil, errors.New("unexpected jwt algorithm")
		}
		return []byte(secret), nil
	}, jwt.WithIssuer(issuer), jwt.WithAudience(audience))
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*AccessClaims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid jwt claims")
	}
	return claims, nil
}

func GenerateRefreshToken() (raw string, hash string, err error) {
	raw, err = randomToken(48)
	if err != nil {
		return "", "", err
	}
	hash = hashToken(raw)
	return raw, hash, nil
}

func HashToken(raw string) string {
	return hashToken(raw)
}

func randomToken(size int) (string, error) {
	buf := make([]byte, size)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

func hashToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

func uintToString(v uint) string {
	return strconv.FormatUint(uint64(v), 10)
}
