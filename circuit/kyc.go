package circuit

import (
	"github.com/consensys/gnark/frontend"
	"github.com/consensys/gnark/std/hash/mimc"
)

// KYCCircuit is the main circuit that combines all KYC checks
// It verifies age, jurisdiction, accreditation, and identity without revealing private data
type KYCCircuit struct {
	// Private inputs (witness)
	Age            frontend.Variable `gnark:",secret"`
	Jurisdiction   frontend.Variable `gnark:",secret"`
	IsAccredited   frontend.Variable `gnark:",secret"` // 1 if accredited, 0 otherwise
	IdentityData   frontend.Variable `gnark:",secret"`
	Nonce          frontend.Variable `gnark:",secret"`

	// Public inputs
	MinAge                frontend.Variable   `gnark:",public"`
	AllowedJurisdictions  []frontend.Variable `gnark:",public"`
	RequireAccreditation  frontend.Variable   `gnark:",public"` // 1 if accreditation required, 0 otherwise
	Commitment            frontend.Variable   `gnark:",public"`
	
	// Verification results (public outputs)
	AgeVerified           frontend.Variable `gnark:",public"`
	JurisdictionVerified  frontend.Variable `gnark:",public"`
	AccreditationVerified frontend.Variable `gnark:",public"`
	IdentityVerified      frontend.Variable `gnark:",public"`
	OverallVerified       frontend.Variable `gnark:",public"` // 1 if all checks pass, 0 otherwise
}

// Define declares the circuit constraints
func (circuit *KYCCircuit) Define(api frontend.API) error {
	// 1. Age verification
	ageDiff := api.Sub(circuit.Age, circuit.MinAge)
	// api.Cmp(0, ageDiff) returns: -1 if ageDiff > 0, 0 if ageDiff == 0, 1 if ageDiff < 0
	// For ageDiff >= 0, we need cmpResult != 1
	cmpResult := api.Cmp(0, ageDiff)
	ageCheck := api.Sub(1, api.IsZero(api.Sub(cmpResult, 1))) // 1 if ageDiff >= 0, 0 otherwise
	api.AssertIsEqual(circuit.AgeVerified, ageCheck)

	// 2. Jurisdiction verification
	var jurisdictionCheck frontend.Variable = 0
	for i := 0; i < len(circuit.AllowedJurisdictions); i++ {
		matches := api.IsZero(api.Sub(circuit.Jurisdiction, circuit.AllowedJurisdictions[i]))
		jurisdictionCheck = api.Add(jurisdictionCheck, matches)
	}
	api.AssertIsLessOrEqual(jurisdictionCheck, 1)
	api.AssertIsEqual(circuit.JurisdictionVerified, jurisdictionCheck)

	// 3. Accreditation verification
	// If accreditation is required, isAccredited must be 1
	// If not required, this check always passes
	accreditationCheck := api.Sub(1, circuit.RequireAccreditation)
	accreditationCheck = api.Add(accreditationCheck, api.Mul(circuit.RequireAccreditation, circuit.IsAccredited))
	api.AssertIsEqual(circuit.AccreditationVerified, accreditationCheck)

	// 4. Identity commitment verification
	// Create commitment using MiMC hash
	mimcHash, err := mimc.NewMiMC(api)
	if err != nil {
		return err
	}
	mimcHash.Write(circuit.IdentityData)
	mimcHash.Write(circuit.Nonce)
	computedCommitment := mimcHash.Sum()
	api.AssertIsEqual(circuit.Commitment, computedCommitment)
	identityCheck := api.IsZero(api.Sub(circuit.Commitment, computedCommitment))
	api.AssertIsEqual(circuit.IdentityVerified, identityCheck)

	// 5. Overall verification - all checks must pass
	// overallVerified = ageVerified AND jurisdictionVerified AND accreditationVerified AND identityVerified
	allChecks := api.Mul(circuit.AgeVerified, circuit.JurisdictionVerified)
	allChecks = api.Mul(allChecks, circuit.AccreditationVerified)
	allChecks = api.Mul(allChecks, circuit.IdentityVerified)
	api.AssertIsEqual(circuit.OverallVerified, allChecks)

	return nil
}

