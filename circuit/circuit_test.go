package circuit

import (
	"testing"

	"github.com/consensys/gnark-crypto/ecc"
	"github.com/consensys/gnark/backend/groth16"
	"github.com/consensys/gnark/frontend"
	"github.com/consensys/gnark/frontend/cs/r1cs"
	"github.com/consensys/gnark/test"
	"github.com/stretchr/testify/assert"
)

func TestAgeCircuit(t *testing.T) {
	circuit := &AgeCircuit{
		Age:         25,
		MinAge:      18,
		AgeVerified: 1,
	}

	field := ecc.BN254.ScalarField()
	err := test.IsSolved(circuit, &AgeCircuit{
		Age:         25,
		MinAge:      18,
		AgeVerified: 1,
	}, field)
	assert.NoError(t, err)
}

func TestJurisdictionCircuit(t *testing.T) {
	circuit := &JurisdictionCircuit{
		Jurisdiction:        1,
		AllowedJurisdictions: []frontend.Variable{1, 2, 3},
		JurisdictionVerified: 1,
	}

	field := ecc.BN254.ScalarField()
	err := test.IsSolved(circuit, &JurisdictionCircuit{
		Jurisdiction:        1,
		AllowedJurisdictions: []frontend.Variable{1, 2, 3},
		JurisdictionVerified: 1,
	}, field)
	assert.NoError(t, err)
}

func TestKYCCircuit(t *testing.T) {
	// Create a simple KYC circuit for testing
	circuit := &KYCCircuit{
		Age:                   25,
		Jurisdiction:          1,
		IsAccredited:          1,
		IdentityData:          12345,
		Nonce:                 67890,
		MinAge:                18,
		AllowedJurisdictions:  []frontend.Variable{1, 2, 3},
		RequireAccreditation:  1,
		Commitment:            0, // Will be computed
		AgeVerified:           1,
		JurisdictionVerified:  1,
		AccreditationVerified: 1,
		IdentityVerified:      1,
		OverallVerified:       1,
	}

	// Test that the circuit compiles
	field := ecc.BN254.ScalarField()
	ccs, err := frontend.Compile(field, r1cs.NewBuilder, circuit)
	assert.NoError(t, err)
	assert.NotNil(t, ccs)

	// Note: Full proof generation would require trusted setup
	// This is a basic compilation test
}

func TestKYCCircuitCompilation(t *testing.T) {
	circuit := &KYCCircuit{
		MinAge:               18,
		AllowedJurisdictions: []frontend.Variable{1, 2, 3},
		RequireAccreditation: 1,
	}

	field := ecc.BN254.ScalarField()
	ccs, err := frontend.Compile(field, r1cs.NewBuilder, circuit)
	assert.NoError(t, err)
	assert.NotNil(t, ccs)

	// Verify it's a Groth16-compatible circuit
	_, _, err = groth16.Setup(ccs)
	assert.NoError(t, err)
}

