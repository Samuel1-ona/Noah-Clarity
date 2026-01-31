package main

import (
	"bytes"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"math/big"
	"os"
	"time"

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
	// Must match the prover's compilation with Merkle proof structure
	// Assume depth 20 for Merkle tree (supports up to 2^20 = 1M jurisdictions)
	merkleDepth := 20

	kycCircuit := &circuit.KYCCircuit{
		// Private inputs
		Age:          0,
		Jurisdiction: 0,
		IsAccredited: 0,
		IdentityData: 0,
		Nonce:        0,
		// Merkle proof fields
		MerklePath:   make([]frontend.Variable, merkleDepth),
		MerkleHelper: make([]frontend.Variable, merkleDepth),
		// Public inputs
		MinAge:               0,
		JurisdictionRoot:     0,
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

	// #region agent log
	logFile2, _ := os.OpenFile("/Users/machine/Documents/Noah-v2/.cursor/debug.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	logEntryVerify := fmt.Sprintf(`{"sessionId":"debug-session","runId":"run1","hypothesisId":"E","location":"proof_verifier.go:137","message":"About to verify proof","data":{"publicInputsCount":%d,"firstInput":"%s","lastInput":"%s"},"timestamp":%d}`+"\n", len(publicInputs), publicInputs[0], publicInputs[len(publicInputs)-1], time.Now().UnixMilli())
	logFile2.WriteString(logEntryVerify)
	logFile2.Close()
	// #endregion agent log

	// Verify the proof
	err = groth16.Verify(proof, pv.vk, pubWitness)
	if err != nil {
		// #region agent log
		logFile3, _ := os.OpenFile("/Users/machine/Documents/Noah-v2/.cursor/debug.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
		logEntryErr := fmt.Sprintf(`{"sessionId":"debug-session","runId":"run1","hypothesisId":"E","location":"proof_verifier.go:139","message":"Verification failed","data":{"error":"%s","publicInputsCount":%d},"timestamp":%d}`+"\n", err.Error(), len(publicInputs), time.Now().UnixMilli())
		logFile3.WriteString(logEntryErr)
		logFile3.Close()
		// #endregion agent log
		return false, fmt.Errorf("proof verification failed: %w", err)
	}

	return true, nil
}

// reconstructPublicWitness reconstructs the circuit structure from public inputs
// Public inputs order: MinAge, JurisdictionRoot, RequireAccreditation, Commitment
func (pv *ProofVerifier) reconstructPublicWitness(publicInputs []string) (*circuit.KYCCircuit, error) {
	// #region agent log
	logFile, _ := os.OpenFile("/Users/machine/Documents/Noah-v2/.cursor/debug.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	logEntry := fmt.Sprintf(`{"sessionId":"debug-session","runId":"run1","hypothesisId":"A","location":"proof_verifier.go:150","message":"Reconstructing witness","data":{"publicInputsCount":%d,"firstInput":"%s","lastInput":"%s"},"timestamp":%d}`+"\n", len(publicInputs), publicInputs[0], publicInputs[len(publicInputs)-1], time.Now().UnixMilli())
	logFile.WriteString(logEntry)
	// #endregion agent log

	// New optimized circuit structure:
	// Public inputs: [MinAge, JurisdictionRoot, RequireAccreditation, Commitment]
	expectedInputs := 4
	if len(publicInputs) != expectedInputs {
		logFile.Close()
		return nil, fmt.Errorf("invalid public inputs: expected %d inputs (MinAge, JurisdictionRoot, RequireAccreditation, Commitment), got %d", expectedInputs, len(publicInputs))
	}

	// Parse MinAge (first input)
	minAgeBytes, err := hex.DecodeString(publicInputs[0])
	if err != nil {
		logFile.Close()
		return nil, fmt.Errorf("invalid MinAge hex: %w", err)
	}
	minAge := new(big.Int).SetBytes(minAgeBytes)

	// Parse JurisdictionRoot (second input)
	jurisdictionRootBytes, err := hex.DecodeString(publicInputs[1])
	if err != nil {
		logFile.Close()
		return nil, fmt.Errorf("invalid JurisdictionRoot hex: %w", err)
	}
	jurisdictionRoot := new(big.Int).SetBytes(jurisdictionRootBytes)

	// Parse RequireAccreditation (third input)
	requireAccredBytes, err := hex.DecodeString(publicInputs[2])
	if err != nil {
		logFile.Close()
		return nil, fmt.Errorf("invalid RequireAccreditation hex: %w", err)
	}
	requireAccred := new(big.Int).SetBytes(requireAccredBytes)

	// Parse Commitment (fourth input)
	commitmentBytes, err := hex.DecodeString(publicInputs[3])
	if err != nil {
		logFile.Close()
		return nil, fmt.Errorf("invalid Commitment hex: %w", err)
	}
	commitment := new(big.Int).SetBytes(commitmentBytes)

	// #region agent log
	logEntry2 := fmt.Sprintf(`{"sessionId":"debug-session","runId":"run1","hypothesisId":"C","location":"proof_verifier.go:218","message":"Parsed all public inputs","data":{"minAge":"%s","jurisdictionRoot":"%s","requireAccred":"%s","commitment":"%s"},"timestamp":%d}`+"\n", minAge.String(), jurisdictionRoot.String(), requireAccred.String(), commitment.String(), time.Now().UnixMilli())
	logFile.WriteString(logEntry2)
	logFile.Close()
	// #endregion agent log

	// Create circuit structure with public input fields set
	// Note: Private inputs and Merkle proof fields are not part of public witness
	return &circuit.KYCCircuit{
		MinAge:               minAge,
		JurisdictionRoot:     jurisdictionRoot,
		RequireAccreditation: requireAccred,
		Commitment:           commitment,
	}, nil
}
