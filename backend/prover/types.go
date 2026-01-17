package main

import (
	"math/big"
)

// ProofRequest represents a request to generate a proof
type ProofRequest struct {
	// Private witness data
	Age            *big.Int   `json:"age"`
	Jurisdiction   *big.Int   `json:"jurisdiction"`
	IsAccredited   *big.Int   `json:"is_accredited"`
	IdentityData   *big.Int   `json:"identity_data"`
	Nonce          *big.Int   `json:"nonce"`

	// Public inputs
	MinAge                *big.Int   `json:"min_age"`
	AllowedJurisdictions  []*big.Int `json:"allowed_jurisdictions"`
	RequireAccreditation  *big.Int   `json:"require_accreditation"`
	Commitment            *big.Int   `json:"commitment"`
}

// ProofResponse represents the generated proof and public inputs
type ProofResponse struct {
	Proof       string   `json:"proof"`        // Serialized proof
	PublicInputs []string `json:"public_inputs"` // Public inputs as hex strings
	Commitment  string   `json:"commitment"`   // Commitment hash
	Success     bool     `json:"success"`
	Error       string   `json:"error,omitempty"`
}

// CircuitConfig holds circuit configuration
type CircuitConfig struct {
	MaxJurisdictions int `json:"max_jurisdictions"`
}

