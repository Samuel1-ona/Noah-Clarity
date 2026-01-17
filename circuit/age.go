package circuit

import (
	"github.com/consensys/gnark/frontend"
)

// AgeCircuit verifies that a user's age meets a minimum threshold
// without revealing the actual age
type AgeCircuit struct {
	// Private inputs (witness)
	Age frontend.Variable `gnark:",secret"`

	// Public inputs
	MinAge      frontend.Variable `gnark:",public"`
	AgeVerified frontend.Variable `gnark:",public"` // 1 if age >= minAge, 0 otherwise
}

// Define declares the circuit constraints
func (circuit *AgeCircuit) Define(api frontend.API) error {
	// Verify that age is non-negative (assuming age is uint)
	// In practice, we'd add a reasonable upper bound too

	// Check if age >= minAge
	// ageVerified = 1 if age >= minAge, else 0
	ageDiff := api.Sub(circuit.Age, circuit.MinAge)
	
	// ageVerified should be 1 if ageDiff >= 0, 0 otherwise
	// api.Cmp(a, b) returns: -1 if a < b, 0 if a == b, 1 if a > b
	// For ageDiff >= 0, we check that Cmp(0, ageDiff) <= 0
	// This means ageDiff is either 0 or positive
	cmpResult := api.Cmp(0, ageDiff) // Returns -1 if ageDiff > 0, 0 if ageDiff == 0, 1 if ageDiff < 0
	// We want ageDiff >= 0, which means cmpResult should be -1 or 0
	// So we check if cmpResult is NOT 1 (i.e., ageDiff is not negative)
	isNonNegative := api.Sub(1, api.IsZero(api.Sub(cmpResult, 1))) // 1 if cmpResult != 1, 0 if cmpResult == 1
	
	// ageVerified = 1 means age >= minAge
	api.AssertIsEqual(circuit.AgeVerified, isNonNegative)

	return nil
}

// AgeCheck performs age verification with a threshold
func AgeCheck(api frontend.API, age, minAge frontend.Variable) frontend.Variable {
	ageDiff := api.Sub(age, minAge)
	cmpResult := api.Cmp(0, ageDiff) // Returns -1 if ageDiff > 0, 0 if ageDiff == 0, 1 if ageDiff < 0
	// Return 1 if ageDiff >= 0 (cmpResult != 1), 0 otherwise
	return api.Sub(1, api.IsZero(api.Sub(cmpResult, 1)))
}

