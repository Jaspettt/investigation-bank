package security

import (
	"sync"
	"time"
)

type Denylist struct {
	mu    sync.RWMutex
	items map[string]time.Time
}

func NewDenylist() *Denylist {
	return &Denylist{items: make(map[string]time.Time)}
}

func (d *Denylist) Add(jti string, exp time.Time) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.items[jti] = exp
}

func (d *Denylist) Contains(jti string) bool {
	d.mu.RLock()
	exp, ok := d.items[jti]
	d.mu.RUnlock()

	if !ok {
		return false
	}

	if time.Now().UTC().After(exp) {
		d.mu.Lock()
		delete(d.items, jti)
		d.mu.Unlock()
		return false
	}
	return true
}
