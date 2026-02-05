package main

import (
	"fmt"

	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// IdentityBinding represents the database model for identity to address mapping
type IdentityBinding struct {
	gorm.Model
	Fingerprint string `gorm:"uniqueIndex;not null"` // Identity fingerprint (nullifier)
	Address     string `gorm:"uniqueIndex;not null"` // Blockchain address
	Commitment  string // Current commitment hash
}

// Store represents the GORM-backed store
type Store struct {
	db *gorm.DB
}

// NewStore creates a new GORM store and performs migrations
func NewStore(dbType, dsn string) (*Store, error) {
	var dialector gorm.Dialector

	switch dbType {
	case "postgres":
		dialector = postgres.Open(dsn)
	case "sqlite":
		dialector = sqlite.Open(dsn)
	default:
		return nil, fmt.Errorf("unsupported database type: %s", dbType)
	}

	db, err := gorm.Open(dialector, &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Auto Migrate the schema
	if err := db.AutoMigrate(&IdentityBinding{}); err != nil {
		return nil, fmt.Errorf("failed to migrate database: %w", err)
	}

	return &Store{db: db}, nil
}

// Save is a no-op for the database store (GORM handles persistence immediately)
func (s *Store) Save() error {
	return nil
}

// SetIdentity binds an identity fingerprint to an address
func (s *Store) SetIdentity(fingerprint, address string) {
	var binding IdentityBinding

	// 1. Check if the address is already bound
	// If so, we update the fingerprint for this address (assuming identity update/rotation)
	result := s.db.Where("address = ?", address).First(&binding)
	if result.Error == nil {
		binding.Fingerprint = fingerprint
		s.db.Save(&binding)
		return
	}

	// 2. Check if the fingerprint exists (migration to new address?)
	result = s.db.Where("fingerprint = ?", fingerprint).First(&binding)
	if result.Error == nil {
		binding.Address = address
		s.db.Save(&binding)
		return
	}

	// 3. Create new binding
	s.db.Create(&IdentityBinding{
		Fingerprint: fingerprint,
		Address:     address,
	})
}

// GetAddress retrieves the address linked to a fingerprint
func (s *Store) GetAddress(fingerprint string) (string, bool) {
	var binding IdentityBinding
	result := s.db.Where("fingerprint = ?", fingerprint).First(&binding)
	if result.Error != nil {
		return "", false
	}
	return binding.Address, true
}

// SetCommitment links an address to a commitment
func (s *Store) SetCommitment(address, commitment string) {
	var binding IdentityBinding
	result := s.db.Where("address = ?", address).First(&binding)
	if result.Error == nil {
		binding.Commitment = commitment
		s.db.Save(&binding)
	} else {
		// If address doesn't exist yet but we want to set commitment (shouldn't happen in current flow)
		s.db.Create(&IdentityBinding{
			Address:    address,
			Commitment: commitment,
		})
	}
}

// GetCommitment retrieves the commitment for an address
func (s *Store) GetCommitment(address string) (string, bool) {
	var binding IdentityBinding
	result := s.db.Where("address = ?", address).First(&binding)
	if result.Error != nil {
		return "", false
	}
	return binding.Commitment, true
}
