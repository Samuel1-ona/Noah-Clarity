package main

import (
	"encoding/json"
	"fmt"
	"math/big"
	"strings"
)

// BigIntString is a wrapper for big.Int that unmarshals from JSON strings
type BigIntString struct {
	*big.Int
}

// UnmarshalJSON implements json.Unmarshaler to handle string JSON values
func (b *BigIntString) UnmarshalJSON(data []byte) error {
	// Remove quotes if present
	str := strings.Trim(string(data), `"`)
	
	// Handle empty string or null
	if str == "" || str == "null" {
		b.Int = big.NewInt(0)
		return nil
	}
	
	b.Int = new(big.Int)
	_, ok := b.Int.SetString(str, 10)
	if !ok {
		// Try as number (fallback)
		var n json.Number
		if err := json.Unmarshal(data, &n); err == nil {
			tempInt := new(big.Int)
			if _, ok := tempInt.SetString(string(n), 10); ok {
				b.Int = tempInt
				return nil
			}
		}
		// Try standard unmarshal as last resort
		var standardBigInt big.Int
		if unmarshalErr := json.Unmarshal(data, &standardBigInt); unmarshalErr == nil {
			b.Int = &standardBigInt
			return nil
		}
		return fmt.Errorf("cannot parse %q as big.Int", str)
	}
	return nil
}

// MarshalJSON implements json.Marshaler
func (b BigIntString) MarshalJSON() ([]byte, error) {
	if b.Int == nil {
		return []byte("0"), nil
	}
	return []byte(`"` + b.Int.String() + `"`), nil
}

// ProofRequest represents a request to generate a proof
type ProofRequest struct {
	// Private witness data
	Age            BigIntString   `json:"age"`
	Jurisdiction   BigIntString   `json:"jurisdiction"`
	IsAccredited   BigIntString   `json:"is_accredited"`
	IdentityData   BigIntString   `json:"identity_data"`
	Nonce          BigIntString   `json:"nonce"`

	// Public inputs
	MinAge                BigIntString    `json:"min_age"`
	AllowedJurisdictions  []BigIntString  `json:"allowed_jurisdictions"`
	RequireAccreditation  BigIntString    `json:"require_accreditation"`
	Commitment            BigIntString    `json:"commitment"`
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
