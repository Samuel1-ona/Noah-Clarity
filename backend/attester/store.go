package main

import (
	"encoding/json"
	"os"
	"sync"
)

// Store represents a simple persistent key-value store
type Store struct {
	IdentityToAddress map[string]string `json:"identity_to_address"` // IdentityFingerprint -> UserAddress
	AddressToCommit   map[string]string `json:"address_to_commit"`   // UserAddress -> Commitment
	mu                sync.RWMutex
	filePath          string
}

// NewStore creates a new store and loads data from file if it exists
func NewStore(filePath string) (*Store, error) {
	s := &Store{
		IdentityToAddress: make(map[string]string),
		AddressToCommit:   make(map[string]string),
		filePath:          filePath,
	}

	if _, err := os.Stat(filePath); err == nil {
		data, err := os.ReadFile(filePath)
		if err != nil {
			return nil, err
		}
		if err := json.Unmarshal(data, s); err != nil {
			return nil, err
		}
	}

	return s, nil
}

// Save writes the store data to disk
func (s *Store) Save() error {
	s.mu.RLock()
	defer s.mu.RUnlock()

	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.filePath, data, 0644)
}

// SetIdentity binds an identity fingerprint to an address
func (s *Store) SetIdentity(fingerprint, address string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.IdentityToAddress[fingerprint] = address
}

// GetAddress retrieves the address linked to a fingerprint
func (s *Store) GetAddress(fingerprint string) (string, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	addr, ok := s.IdentityToAddress[fingerprint]
	return addr, ok
}

// SetCommitment links an address to a commitment
func (s *Store) SetCommitment(address, commitment string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.AddressToCommit[address] = commitment
}

// GetCommitment retrieves the commitment for an address
func (s *Store) GetCommitment(address string) (string, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	commit, ok := s.AddressToCommit[address]
	return commit, ok
}
