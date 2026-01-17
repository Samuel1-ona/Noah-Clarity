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

// TestReconstructPublicWitnessWithManyJurisdictions tests that the verifier
// correctly handles a large number of jurisdictions (e.g., 250)
func TestReconstructPublicWitnessWithManyJurisdictions(t *testing.T) {
	pv := NewProofVerifier("../prover/keys/verifying.key")

	// Simulate 250 jurisdictions
	publicInputs := make([]string, 253) // 1 MinAge + 250 jurisdictions + 1 RequireAccreditation + 1 Commitment

	// MinAge (first input) - pad to ensure even-length hex
	publicInputs[0] = padHex(big.NewInt(18).Text(16))

	// 250 jurisdictions
	for i := 0; i < 250; i++ {
		publicInputs[1+i] = padHex(big.NewInt(int64(i + 1)).Text(16))
	}

	// RequireAccreditation (second to last)
	publicInputs[251] = padHex(big.NewInt(0).Text(16))

	// Commitment (last input) - use a larger value to ensure proper hex encoding
	publicInputs[252] = padHex(big.NewInt(12345).Text(16))

	// Reconstruct witness
	witness, err := pv.reconstructPublicWitness(publicInputs)
	if err != nil {
		t.Fatalf("Failed to reconstruct witness: %v", err)
	}

	// Verify we got 250 jurisdictions
	if len(witness.AllowedJurisdictions) != 250 {
		t.Errorf("Expected 250 jurisdictions, got %d", len(witness.AllowedJurisdictions))
	}

	// Verify first jurisdiction
	firstJurisdiction, ok := witness.AllowedJurisdictions[0].(*big.Int)
	if !ok {
		t.Fatal("Failed to cast first jurisdiction to *big.Int")
	}
	if firstJurisdiction.Int64() != 1 {
		t.Errorf("Expected first jurisdiction to be 1, got %d", firstJurisdiction.Int64())
	}

	// Verify last jurisdiction
	lastJurisdiction, ok := witness.AllowedJurisdictions[249].(*big.Int)
	if !ok {
		t.Fatal("Failed to cast last jurisdiction to *big.Int")
	}
	if lastJurisdiction.Int64() != 250 {
		t.Errorf("Expected last jurisdiction to be 250, got %d", lastJurisdiction.Int64())
	}

	// Verify MinAge
	if witness.MinAge.(*big.Int).Int64() != 18 {
		t.Errorf("Expected MinAge to be 18, got %d", witness.MinAge.(*big.Int).Int64())
	}

	// Verify Commitment
	if witness.Commitment.(*big.Int).Int64() != 12345 {
		t.Errorf("Expected Commitment to be 12345, got %d", witness.Commitment.(*big.Int).Int64())
	}
}

// TestReconstructPublicWitnessWithSingleJurisdiction tests minimum case
func TestReconstructPublicWitnessWithSingleJurisdiction(t *testing.T) {
	pv := NewProofVerifier("../prover/keys/verifying.key")

	publicInputs := []string{
		padHex(big.NewInt(18).Text(16)),    // MinAge
		padHex(big.NewInt(1).Text(16)),     // Single jurisdiction
		padHex(big.NewInt(0).Text(16)),     // RequireAccreditation
		padHex(big.NewInt(12345).Text(16)), // Commitment
	}

	witness, err := pv.reconstructPublicWitness(publicInputs)
	if err != nil {
		t.Fatalf("Failed to reconstruct witness: %v", err)
	}

	if len(witness.AllowedJurisdictions) != 1 {
		t.Errorf("Expected 1 jurisdiction, got %d", len(witness.AllowedJurisdictions))
	}
}

