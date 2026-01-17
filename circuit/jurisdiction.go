package circuit

import (
	"github.com/consensys/gnark/frontend"
)

// JurisdictionCircuit verifies that a user's jurisdiction is in an allowed list
// without revealing the actual jurisdiction
type JurisdictionCircuit struct {
	// Private inputs
	Jurisdiction frontend.Variable `gnark:",secret"` // Encoded jurisdiction ID

	// Public inputs
	AllowedJurisdictions []frontend.Variable `gnark:",public"` // List of allowed jurisdiction IDs
	JurisdictionVerified frontend.Variable   `gnark:",public"` // 1 if jurisdiction is allowed, 0 otherwise
}

// Define declares the circuit constraints
func (circuit *JurisdictionCircuit) Define(api frontend.API) error {
	// Check if jurisdiction is in the allowed list
	// This is done by checking if jurisdiction equals any of the allowed jurisdictions
	var isAllowed frontend.Variable = 0

	for i := 0; i < len(circuit.AllowedJurisdictions); i++ {
		// Check if jurisdiction matches this allowed jurisdiction
		matches := api.IsZero(api.Sub(circuit.Jurisdiction, circuit.AllowedJurisdictions[i]))
		// OR with previous matches
		isAllowed = api.Add(isAllowed, matches)
	}

	// Ensure isAllowed is at most 1 (can't match multiple)
	api.AssertIsLessOrEqual(isAllowed, 1)

	// jurisdictionVerified should equal isAllowed
	api.AssertIsEqual(circuit.JurisdictionVerified, isAllowed)

	return nil
}

// JurisdictionCheck verifies if a jurisdiction is in the allowed list
func JurisdictionCheck(api frontend.API, jurisdiction frontend.Variable, allowed []frontend.Variable) frontend.Variable {
	var isAllowed frontend.Variable = 0

	for i := 0; i < len(allowed); i++ {
		matches := api.IsZero(api.Sub(jurisdiction, allowed[i]))
		isAllowed = api.Add(isAllowed, matches)
	}

	return isAllowed
}

