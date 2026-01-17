package circuit

import (
	"github.com/consensys/gnark/frontend"
	"github.com/consensys/gnark/std/hash/mimc"
)

// IdentityCircuit creates a commitment to identity data
// and verifies uniqueness without revealing the identity
type IdentityCircuit struct {
	// Private inputs
	IdentityData frontend.Variable `gnark:",secret"` // Hash of identity data
	Nonce        frontend.Variable `gnark:",secret"` // Random nonce for uniqueness

	// Public inputs
	Commitment frontend.Variable `gnark:",public"` // Commitment hash
}

// Define declares the circuit constraints
func (circuit *IdentityCircuit) Define(api frontend.API) error {
	// Create commitment using MiMC hash
	// commitment = MiMC(identityData || nonce)
	mimcHash, err := mimc.NewMiMC(api)
	if err != nil {
		return err
	}

	// Hash identity data and nonce together
	mimcHash.Write(circuit.IdentityData)
	mimcHash.Write(circuit.Nonce)
	computedCommitment := mimcHash.Sum()

	// Verify that the provided commitment matches the computed one
	api.AssertIsEqual(circuit.Commitment, computedCommitment)

	return nil
}

// CreateCommitment creates a commitment from identity data and nonce
func CreateCommitment(api frontend.API, identityData, nonce frontend.Variable) (frontend.Variable, error) {
	mimcHash, err := mimc.NewMiMC(api)
	if err != nil {
		return nil, err
	}

	mimcHash.Write(identityData)
	mimcHash.Write(nonce)
	return mimcHash.Sum(), nil
}

