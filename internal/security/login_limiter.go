package security

import (
	"sync"
	"time"
)

type LoginLimiter struct {
	mu            sync.Mutex
	maxAttempts   int
	blockDuration time.Duration
	state         map[string]attemptState
}

type attemptState struct {
	fails        int
	blockedUntil time.Time
}

func NewLoginLimiter(maxAttempts int, blockDuration time.Duration) *LoginLimiter {
	return &LoginLimiter{
		maxAttempts:   maxAttempts,
		blockDuration: blockDuration,
		state:         make(map[string]attemptState),
	}
}

func (l *LoginLimiter) IsBlocked(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	st, ok := l.state[key]
	if !ok {
		return false
	}
	if time.Now().UTC().After(st.blockedUntil) {
		st.blockedUntil = time.Time{}
		st.fails = 0
		l.state[key] = st
		return false
	}
	return !st.blockedUntil.IsZero()
}

func (l *LoginLimiter) RegisterFailure(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()

	st := l.state[key]
	st.fails++
	if st.fails >= l.maxAttempts {
		st.blockedUntil = time.Now().UTC().Add(l.blockDuration)
	}
	l.state[key] = st
}

func (l *LoginLimiter) RegisterSuccess(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.state, key)
}
