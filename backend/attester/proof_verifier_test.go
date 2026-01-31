package main

import (
	"math/big"
	"testing"
)

// padHex ensures hex string is even length by padding with leading zero if needed
func padHex(s string) string {
	if len(s)%2 == 1 {
		return "0" + s
	}
	return s
}

// TestReconstructPublicWitnessOptimized tests the optimized circuit structure
// with Merkle proofs (4 public inputs instead of 258)
func TestReconstructPublicWitnessOptimized(t *testing.T) {
	pv := NewProofVerifier("../prover/keys/verifying.key")

	// New optimized structure: [MinAge, JurisdictionRoot, RequireAccreditation, Commitment]
	publicInputs := []string{
		padHex(big.NewInt(18).Text(16)),    // MinAge
		padHex(big.NewInt(12345).Text(16)), // JurisdictionRoot (Merkle root)
		padHex(big.NewInt(0).Text(16)),     // RequireAccreditation
		padHex(big.NewInt(67890).Text(16)), // Commitment
	}

	// Reconstruct witness
	witness, err := pv.reconstructPublicWitness(publicInputs)
	if err != nil {
		t.Fatalf("Failed to reconstruct witness: %v", err)
	}

	// Verify MinAge
	minAge, ok := witness.MinAge.(*big.Int)
	if !ok {
		t.Fatal("Failed to cast MinAge to *big.Int")
	}
	if minAge.Int64() != 18 {
		t.Errorf("Expected MinAge to be 18, got %d", minAge.Int64())
	}

	// Verify JurisdictionRoot
	jurisdictionRoot, ok := witness.JurisdictionRoot.(*big.Int)
	if !ok {
		t.Fatal("Failed to cast JurisdictionRoot to *big.Int")
	}
	if jurisdictionRoot.Int64() != 12345 {
		t.Errorf("Expected JurisdictionRoot to be 12345, got %d", jurisdictionRoot.Int64())
	}

	// Verify RequireAccreditation
	requireAccred, ok := witness.RequireAccreditation.(*big.Int)
	if !ok {
		t.Fatal("Failed to cast RequireAccreditation to *big.Int")
	}
	if requireAccred.Int64() != 0 {
		t.Errorf("Expected RequireAccreditation to be 0, got %d", requireAccred.Int64())
	}

	// Verify Commitment
	commitment, ok := witness.Commitment.(*big.Int)
	if !ok {
		t.Fatal("Failed to cast Commitment to *big.Int")
	}
	if commitment.Int64() != 67890 {
		t.Errorf("Expected Commitment to be 67890, got %d", commitment.Int64())
	}
}

// TestReconstructPublicWitnessInvalidInputCount tests error handling for wrong number of inputs
func TestReconstructPublicWitnessInvalidInputCount(t *testing.T) {
	pv := NewProofVerifier("../prover/keys/verifying.key")

	// Test with too few inputs
	publicInputs := []string{
		padHex(big.NewInt(18).Text(16)), // MinAge only
	}

	_, err := pv.reconstructPublicWitness(publicInputs)
	if err == nil {
		t.Error("Expected error for insufficient public inputs, got nil")
	}

	// Test with too many inputs
	publicInputs = []string{
		padHex(big.NewInt(18).Text(16)),
		padHex(big.NewInt(12345).Text(16)),
		padHex(big.NewInt(0).Text(16)),
		padHex(big.NewInt(67890).Text(16)),
		padHex(big.NewInt(999).Text(16)), // Extra input
	}

	_, err = pv.reconstructPublicWitness(publicInputs)
	if err == nil {
		t.Error("Expected error for too many public inputs, got nil")
	}
}

// TestReconstructPublicWitnessInvalidHex tests error handling for invalid hex values
func TestReconstructPublicWitnessInvalidHex(t *testing.T) {
	pv := NewProofVerifier("../prover/keys/verifying.key")

	// Test with invalid hex in MinAge
	publicInputs := []string{
		"INVALID_HEX",                      // Invalid MinAge
		padHex(big.NewInt(12345).Text(16)), // JurisdictionRoot
		padHex(big.NewInt(0).Text(16)),     // RequireAccreditation
		padHex(big.NewInt(67890).Text(16)), // Commitment
	}

	_, err := pv.reconstructPublicWitness(publicInputs)
	if err == nil {
		t.Error("Expected error for invalid hex in MinAge, got nil")
	}
}

// TestReconstructPublicWitnessLargeValues tests handling of large BigInt values
func TestReconstructPublicWitnessLargeValues(t *testing.T) {
	pv := NewProofVerifier("../prover/keys/verifying.key")

	// Use very large values to test BigInt handling
	largeValue := new(big.Int)
	largeValue.SetString("123456789012345678901234567890", 10)

	publicInputs := []string{
		padHex(big.NewInt(21).Text(16)), // MinAge
		padHex(largeValue.Text(16)),     // JurisdictionRoot (large value)
		padHex(big.NewInt(1).Text(16)),  // RequireAccreditation
		padHex(largeValue.Text(16)),     // Commitment (large value)
	}

	witness, err := pv.reconstructPublicWitness(publicInputs)
	if err != nil {
		t.Fatalf("Failed to reconstruct witness with large values: %v", err)
	}

	// Verify JurisdictionRoot
	jurisdictionRoot, ok := witness.JurisdictionRoot.(*big.Int)
	if !ok {
		t.Fatal("Failed to cast JurisdictionRoot to *big.Int")
	}
	if jurisdictionRoot.Cmp(largeValue) != 0 {
		t.Errorf("Expected JurisdictionRoot to be %s, got %s", largeValue.String(), jurisdictionRoot.String())
	}

	// Verify Commitment
	commitment, ok := witness.Commitment.(*big.Int)
	if !ok {
		t.Fatal("Failed to cast Commitment to *big.Int")
	}
	if commitment.Cmp(largeValue) != 0 {
		t.Errorf("Expected Commitment to be %s, got %s", largeValue.String(), commitment.String())
	}
}
