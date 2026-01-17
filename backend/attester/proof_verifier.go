package main

import (
	"bytes"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"math/big"
	"os"

	"noah-v2/circuit"

	"github.com/consensys/gnark-crypto/ecc"
	"github.com/consensys/gnark/backend/groth16"
	"github.com/consensys/gnark/constraint"
	"github.com/consensys/gnark/frontend"
	"github.com/consensys/gnark/frontend/cs/r1cs"
)

// ProofVerifier handles proof verification using the verification key
type ProofVerifier struct {
	ccs         constraint.ConstraintSystem
	vk          groth16.VerifyingKey
	initialized bool
	keyPath     string
}

// NewProofVerifier creates a new proof verifier
func NewProofVerifier(verifyingKeyPath string) *ProofVerifier {
	return &ProofVerifier{
		initialized: false,
		keyPath:     verifyingKeyPath,
	}
}

// Initialize compiles the circuit and loads the verification key
func (pv *ProofVerifier) Initialize() error {
	if pv.initialized {
		return nil
	}

	// Compile the circuit (same as prover)
	kycCircuit := &circuit.KYCCircuit{
		MinAge:               0, // Placeholder for compilation
		AllowedJurisdictions: []frontend.Variable{},
		RequireAccreditation: 0,
		Commitment:           0,
	}

	field := ecc.BN254.ScalarField()
	var err error
	pv.ccs, err = frontend.Compile(field, r1cs.NewBuilder, kycCircuit)
	if err != nil {
		return fmt.Errorf("failed to compile circuit: %w", err)
	}

	// Load verification key
	if err := pv.loadVerifyingKey(); err != nil {
		return fmt.Errorf("failed to load verifying key: %w", err)
	}

	pv.initialized = true
	return nil
}

// loadVerifyingKey loads the verification key from file
func (pv *ProofVerifier) loadVerifyingKey() error {
	// Check if key file exists
	if _, err := os.Stat(pv.keyPath); os.IsNotExist(err) {
		return fmt.Errorf("verifying key file does not exist at %s", pv.keyPath)
	}

	// Load verifying key
	vkFile, err := os.Open(pv.keyPath)
	if err != nil {
		return fmt.Errorf("failed to open verifying key file: %w", err)
	}
	defer vkFile.Close()

	pv.vk = groth16.NewVerifyingKey(ecc.BN254)
	if _, err := pv.vk.ReadFrom(vkFile); err != nil {
		return fmt.Errorf("failed to read verifying key: %w", err)
	}

	return nil
}

// VerifyProof verifies a base64-encoded proof with public inputs
func (pv *ProofVerifier) VerifyProof(proofBase64 string, publicInputs []string) (bool, error) {
	// Initialize if not already done
	if !pv.initialized {
		if err := pv.Initialize(); err != nil {
			return false, fmt.Errorf("failed to initialize verifier: %w", err)
		}
	}

	// Decode base64 proof
	proofBytes, err := base64.StdEncoding.DecodeString(proofBase64)
	if err != nil {
		return false, fmt.Errorf("failed to decode proof: %w", err)
	}

	// Deserialize proof
	proof := groth16.NewProof(ecc.BN254)
	if _, err := proof.ReadFrom(bytes.NewReader(proofBytes)); err != nil {
		return false, fmt.Errorf("failed to deserialize proof: %w", err)
	}

	// Reconstruct public witness from public inputs
	publicWitnessData, err := pv.reconstructPublicWitness(publicInputs)
	if err != nil {
		return false, fmt.Errorf("failed to reconstruct public witness: %w", err)
	}

	// Create public witness
	field := ecc.BN254.ScalarField()
	publicWitness, err := frontend.NewWitness(publicWitnessData, field, frontend.PublicOnly())
	if err != nil {
		return false, fmt.Errorf("failed to create public witness: %w", err)
	}

	// Extract public part
	pubWitness, err := publicWitness.Public()
	if err != nil {
		return false, fmt.Errorf("failed to extract public witness: %w", err)
	}

	// Verify the proof
	err = groth16.Verify(proof, pv.vk, pubWitness)
	if err != nil {
		return false, fmt.Errorf("proof verification failed: %w", err)
	}

	return true, nil
}

// reconstructPublicWitness reconstructs the circuit structure from public inputs
// Public inputs order: MinAge, AllowedJurisdictions..., RequireAccreditation, Commitment
func (pv *ProofVerifier) reconstructPublicWitness(publicInputs []string) (*circuit.KYCCircuit, error) {
	if len(publicInputs) < 4 {
		return nil, fmt.Errorf("insufficient public inputs: expected at least 4, got %d", len(publicInputs))
	}

	// Parse MinAge (first input)
	minAgeBytes, err := hex.DecodeString(publicInputs[0])
	if err != nil {
		return nil, fmt.Errorf("invalid MinAge hex: %w", err)
	}
	minAge := new(big.Int).SetBytes(minAgeBytes)

	// Parse AllowedJurisdictions
	// Public inputs structure: [MinAge, ...Jurisdictions..., RequireAccreditation, Commitment]
	// Total fixed inputs = 3 (MinAge, RequireAccreditation, Commitment)
	// Number of jurisdictions = total inputs - 3 fixed inputs
	// This supports any number of jurisdictions (e.g., 1, 10, 250, etc.)
	numJurisdictions := len(publicInputs) - 3
	if numJurisdictions < 1 {
		return nil, fmt.Errorf("invalid public inputs: expected at least 1 jurisdiction, got %d", numJurisdictions)
	}
	allowedJurisdictions := make([]frontend.Variable, numJurisdictions)
	for i := 0; i < numJurisdictions; i++ {
		jBytes, err := hex.DecodeString(publicInputs[1+i])
		if err != nil {
			return nil, fmt.Errorf("invalid jurisdiction %d hex: %w", i, err)
		}
		allowedJurisdictions[i] = new(big.Int).SetBytes(jBytes)
	}

	// Parse RequireAccreditation (second to last)
	requireAccredBytes, err := hex.DecodeString(publicInputs[len(publicInputs)-2])
	if err != nil {
		return nil, fmt.Errorf("invalid RequireAccreditation hex: %w", err)
	}
	requireAccred := new(big.Int).SetBytes(requireAccredBytes)

	// Parse Commitment (last input)
	commitmentBytes, err := hex.DecodeString(publicInputs[len(publicInputs)-1])
	if err != nil {
		return nil, fmt.Errorf("invalid Commitment hex: %w", err)
	}
	commitment := new(big.Int).SetBytes(commitmentBytes)

	// Create circuit structure with public input fields set
	// Output fields (AgeVerified, etc.) are set to zero - they will be computed by the circuit during verification
	return &circuit.KYCCircuit{
		MinAge:               minAge,
		AllowedJurisdictions: allowedJurisdictions,
		RequireAccreditation: requireAccred,
		Commitment:           commitment,
		// Private fields remain zero/unset (not needed for public witness)
		// Output fields set to zero - circuit will compute them during verification
		AgeVerified:           0,
		JurisdictionVerified:  0,
		AccreditationVerified: 0,
		IdentityVerified:      0,
		OverallVerified:       0,
	}, nil
}

