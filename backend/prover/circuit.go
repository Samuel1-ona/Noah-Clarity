package main

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"noah-v2/circuit"

	"github.com/consensys/gnark-crypto/ecc"
	"github.com/consensys/gnark/backend/groth16"
	"github.com/consensys/gnark/constraint"
	"github.com/consensys/gnark/frontend"
	"github.com/consensys/gnark/frontend/cs/r1cs"
)

// CircuitManager handles circuit compilation and proof generation
type CircuitManager struct {
	ccs         constraint.ConstraintSystem
	pk          groth16.ProvingKey
	vk          groth16.VerifyingKey
	initialized bool
	config      *Config
}

// NewCircuitManager creates a new circuit manager
func NewCircuitManager() *CircuitManager {
	return &CircuitManager{
		initialized: false,
		config:      LoadConfig(),
	}
}

// Initialize compiles the circuit and loads/generates keys
func (cm *CircuitManager) Initialize() error {
	// Compile the circuit
	// Note: gnark requires fixed-size arrays for compilation
	// We use Merkle proofs for jurisdiction verification (depth 20 supports up to 2^20 = 1M jurisdictions)
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

	// Get the scalar field for BN254 curve (used by Groth16)
	field := ecc.BN254.ScalarField()

	var err error
	cm.ccs, err = frontend.Compile(field, r1cs.NewBuilder, kycCircuit)
	if err != nil {
		return fmt.Errorf("failed to compile circuit: %w", err)
	}

	// Try to load keys from files, generate if they don't exist
	if err := cm.loadKeys(); err != nil {
		// Keys don't exist or failed to load, generate new ones
		cm.pk, cm.vk, err = groth16.Setup(cm.ccs)
		if err != nil {
			return fmt.Errorf("failed to setup keys: %w", err)
		}

		// Mark as initialized temporarily to allow saving
		cm.initialized = true

		// Save the newly generated keys
		if err := cm.SaveKeys(cm.config.ProvingKeyPath, cm.config.VerifyingKeyPath); err != nil {
			return fmt.Errorf("failed to save generated keys: %w", err)
		}
	} else {
		// Keys loaded successfully
		cm.initialized = true
	}

	return nil
}

// loadKeys loads proving and verifying keys from files
func (cm *CircuitManager) loadKeys() error {
	// Check if key files exist
	if _, err := os.Stat(cm.config.ProvingKeyPath); os.IsNotExist(err) {
		return fmt.Errorf("proving key file does not exist")
	}
	if _, err := os.Stat(cm.config.VerifyingKeyPath); os.IsNotExist(err) {
		return fmt.Errorf("verifying key file does not exist")
	}

	// Load proving key
	pkFile, err := os.Open(cm.config.ProvingKeyPath)
	if err != nil {
		return fmt.Errorf("failed to open proving key file: %w", err)
	}
	defer pkFile.Close()

	cm.pk = groth16.NewProvingKey(ecc.BN254)
	if _, err := cm.pk.ReadFrom(pkFile); err != nil {
		return fmt.Errorf("failed to read proving key: %w", err)
	}

	// Load verifying key
	vkFile, err := os.Open(cm.config.VerifyingKeyPath)
	if err != nil {
		return fmt.Errorf("failed to open verifying key file: %w", err)
	}
	defer vkFile.Close()

	cm.vk = groth16.NewVerifyingKey(ecc.BN254)
	if _, err := cm.vk.ReadFrom(vkFile); err != nil {
		return fmt.Errorf("failed to read verifying key: %w", err)
	}

	return nil
}

// GenerateProof generates a Groth16 proof for the given witness
func (cm *CircuitManager) GenerateProof(req *ProofRequest) (*ProofResponse, error) {
	if !cm.initialized {
		if err := cm.Initialize(); err != nil {
			return nil, err
		}
	}

	// Create witness from request
	// The circuit now uses Merkle proofs for jurisdiction verification

	// Compute the commitment from identity data and nonce (matches circuit logic)
	// The circuit computes: MiMC(IdentityData || Nonce)
	computedCommitment, err := computeCommitment(req.IdentityData.Int, req.Nonce.Int)
	if err != nil {
		return &ProofResponse{
			Success: false,
			Error:   fmt.Sprintf("failed to compute commitment: %v", err),
		}, err
	}

	witnessData := &circuit.KYCCircuit{
		// Private inputs
		Age:          req.Age.Int,
		Jurisdiction: req.Jurisdiction.Int,
		IsAccredited: req.IsAccredited.Int,
		IdentityData: req.IdentityData.Int,
		Nonce:        req.Nonce.Int,
		// Merkle proof fields (must be provided in request)
		MerklePath:   req.MerklePath,
		MerkleHelper: req.MerkleHelper,
		// Public inputs
		MinAge:               req.MinAge.Int,
		JurisdictionRoot:     req.JurisdictionRoot.Int,
		RequireAccreditation: req.RequireAccreditation.Int,
		Commitment:           computedCommitment, // Use computed commitment
	}

	// Create full witness (with both private and public inputs)
	field := ecc.BN254.ScalarField()
	witnessFull, err := frontend.NewWitness(witnessData, field)
	if err != nil {
		return &ProofResponse{
			Success: false,
			Error:   fmt.Sprintf("failed to create witness: %v", err),
		}, err
	}

	// Generate proof
	proof, err := groth16.Prove(cm.ccs, cm.pk, witnessFull)
	if err != nil {
		return &ProofResponse{
			Success: false,
			Error:   fmt.Sprintf("proof generation failed: %v", err),
		}, err
	}

	// Serialize proof using binary format (proper serialization)
	var proofBuf bytes.Buffer
	if _, err := proof.WriteTo(&proofBuf); err != nil {
		return &ProofResponse{
			Success: false,
			Error:   fmt.Sprintf("proof serialization failed: %v", err),
		}, err
	}
	// Encode to base64 for JSON transport
	proofBytes := base64.StdEncoding.EncodeToString(proofBuf.Bytes())

	// Extract public witness for public inputs
	publicWitness, err := witnessFull.Public()
	if err != nil {
		return &ProofResponse{
			Success: false,
			Error:   fmt.Sprintf("failed to extract public witness: %v", err),
		}, err
	}

	// Extract public inputs from witness in the correct order
	// New optimized circuit public inputs: MinAge, JurisdictionRoot, RequireAccreditation, Commitment
	publicInputs := make([]string, 0)

	// padHex ensures hex string is even length by padding with leading zero if needed
	padHex := func(s string) string {
		if len(s)%2 == 1 {
			return "0" + s
		}
		return s
	}

	// #region agent log
	logFile, _ := os.OpenFile("/Users/machine/Documents/Noah-v2/.cursor/debug.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	logEntry := fmt.Sprintf(`{"sessionId":"debug-session","runId":"run1","hypothesisId":"A","location":"circuit.go:229","message":"Starting public inputs construction (optimized)","data":{"computedCommitmentHex":"%s"},"timestamp":%d}`+"\n", padHex(computedCommitment.Text(16)), time.Now().UnixMilli())
	logFile.WriteString(logEntry)
	// #endregion agent log

	// Add MinAge
	minAgeHex := padHex(req.MinAge.Int.Text(16))
	publicInputs = append(publicInputs, minAgeHex)

	// Add JurisdictionRoot
	jurisdictionRootHex := padHex(req.JurisdictionRoot.Int.Text(16))
	publicInputs = append(publicInputs, jurisdictionRootHex)

	// Add RequireAccreditation
	requireAccredHex := padHex(req.RequireAccreditation.Int.Text(16))
	publicInputs = append(publicInputs, requireAccredHex)

	// Add Commitment (use computed commitment)
	commitmentHex := padHex(computedCommitment.Text(16))
	publicInputs = append(publicInputs, commitmentHex)

	// #region agent log
	logEntry2 := fmt.Sprintf(`{"sessionId":"debug-session","runId":"run1","hypothesisId":"A","location":"circuit.go:278","message":"Final public inputs (optimized)","data":{"totalCount":%d,"minAge":"%s","jurisdictionRoot":"%s","requireAccred":"%s","commitment":"%s"},"timestamp":%d}`+"\n", len(publicInputs), minAgeHex, jurisdictionRootHex, requireAccredHex, commitmentHex, time.Now().UnixMilli())
	logFile.WriteString(logEntry2)
	logFile.Close()
	// #endregion agent log

	_ = publicWitness // Use publicWitness for verification later

	// padHex ensures hex string is even length (defined earlier in function)
	return &ProofResponse{
		Proof:        proofBytes, // Base64 encoded binary proof
		PublicInputs: publicInputs,
		Commitment:   padHex(computedCommitment.Text(16)), // Use computed commitment
		Success:      true,
	}, nil
}

// VerifyProof verifies a proof using the stored verifying key
// This is a helper that takes the public witness directly (from frontend.NewWitness().Public())
func (cm *CircuitManager) VerifyProof(proof groth16.Proof, publicWitnessData *circuit.KYCCircuit) error {
	if !cm.initialized {
		return fmt.Errorf("circuit manager not initialized")
	}

	// Create public witness from the circuit data
	field := ecc.BN254.ScalarField()
	publicWitness, err := frontend.NewWitness(publicWitnessData, field, frontend.PublicOnly())
	if err != nil {
		return fmt.Errorf("failed to create public witness: %w", err)
	}

	// Extract public part
	pubWitness, err := publicWitness.Public()
	if err != nil {
		return fmt.Errorf("failed to extract public witness: %w", err)
	}

	return groth16.Verify(proof, cm.vk, pubWitness)
}

// VerifyProofFromBase64 verifies a proof from a base64-encoded string
// publicWitnessData should be the circuit struct with only public fields set
func (cm *CircuitManager) VerifyProofFromBase64(proofBase64 string, publicWitnessData *circuit.KYCCircuit) error {
	if !cm.initialized {
		return fmt.Errorf("circuit manager not initialized")
	}

	// Decode base64 proof
	proofBytes, err := base64.StdEncoding.DecodeString(proofBase64)
	if err != nil {
		return fmt.Errorf("failed to decode proof: %w", err)
	}

	// Deserialize proof
	proof := groth16.NewProof(ecc.BN254)
	if _, err := proof.ReadFrom(bytes.NewReader(proofBytes)); err != nil {
		return fmt.Errorf("failed to deserialize proof: %w", err)
	}

	return cm.VerifyProof(proof, publicWitnessData)
}

// SaveKeys saves proving and verifying keys to files
func (cm *CircuitManager) SaveKeys(provingKeyPath, verifyingKeyPath string) error {
	if !cm.initialized {
		return fmt.Errorf("circuit manager not initialized")
	}

	// Create directories if they don't exist
	keyDir := filepath.Dir(provingKeyPath)
	if err := os.MkdirAll(keyDir, 0755); err != nil {
		return fmt.Errorf("failed to create key directory: %w", err)
	}

	// Save proving key with proper file permissions (read-only for owner)
	pkFile, err := os.OpenFile(provingKeyPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0600)
	if err != nil {
		return fmt.Errorf("failed to create proving key file: %w", err)
	}
	defer pkFile.Close()

	if _, err := cm.pk.WriteTo(pkFile); err != nil {
		return fmt.Errorf("failed to write proving key: %w", err)
	}

	// Save verifying key (can be world-readable as it's public)
	vkFile, err := os.OpenFile(verifyingKeyPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0644)
	if err != nil {
		return fmt.Errorf("failed to create verifying key file: %w", err)
	}
	defer vkFile.Close()

	if _, err := cm.vk.WriteTo(vkFile); err != nil {
		return fmt.Errorf("failed to write verifying key: %w", err)
	}

	return nil
}
