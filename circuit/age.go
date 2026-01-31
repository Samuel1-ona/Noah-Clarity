package circuit

import (
	"github.com/consensys/gnark/frontend"
)

// AgeCircuit verifies that a user's age meets a minimum threshold
// without revealing the actual age
// Optimized: Uses direct assertion instead of boolean flags
type AgeCircuit struct {
	// Private inputs (witness)
	Age frontend.Variable `gnark:",secret"`

	// Public inputs
	MinAge frontend.Variable `gnark:",public"`
}

// Define declares the circuit constraints
func (circuit *AgeCircuit) Define(api frontend.API) error {
	// Direct assertion: Age >= MinAge
	// This is more efficient than computing a boolean flag
	api.AssertIsLessOrEqual(circuit.MinAge, circuit.Age)

	return nil
}

// AgeCheck performs age verification with a threshold
// Returns without error if age >= minAge, otherwise the circuit will fail
func AgeCheck(api frontend.API, age, minAge frontend.Variable) {
	api.AssertIsLessOrEqual(minAge, age)
}
