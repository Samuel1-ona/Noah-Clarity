package main

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"math/big"
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
	// We use a reasonable maximum (e.g., 250 jurisdictions as discussed)
	// The actual number used in proofs can be less than this
	maxJurisdictions := 250
	allowedJurisdictions := make([]frontend.Variable, maxJurisdictions)
	for i := range allowedJurisdictions {
		allowedJurisdictions[i] = 0 // Placeholder values for compilation
	}
	
	kycCircuit := &circuit.KYCCircuit{
		MinAge:               0, // Placeholder, will be set per request
		AllowedJurisdictions: allowedJurisdictions,
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
	// The circuit was compiled with maxJurisdictions (250), so we need to pad
	// the AllowedJurisdictions array to match the compiled structure
	maxJurisdictions := 250
	allowedJurisdictions := make([]frontend.Variable, maxJurisdictions)
	
	// Copy the provided jurisdictions
	for i := range allowedJurisdictions {
		if i < len(req.AllowedJurisdictions) {
			allowedJurisdictions[i] = req.AllowedJurisdictions[i].Int
		} else {
			// Pad with 0 for unused slots (circuit uses len() so padding won't affect logic)
			allowedJurisdictions[i] = big.NewInt(0)
		}
	}
	
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
		Age:            req.Age.Int,
		Jurisdiction:   req.Jurisdiction.Int,
		IsAccredited:   req.IsAccredited.Int,
		IdentityData:   req.IdentityData.Int,
		Nonce:          req.Nonce.Int,
		MinAge:         req.MinAge.Int,
		AllowedJurisdictions: allowedJurisdictions,
		RequireAccreditation: req.RequireAccreditation.Int,
		Commitment:     computedCommitment, // Use computed commitment instead of provided one
		AgeVerified:    1, // Will be computed by circuit
		JurisdictionVerified: 1,
		AccreditationVerified: 1,
		IdentityVerified: 1,
		OverallVerified: 1,
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
	// Public inputs are: MinAge, AllowedJurisdictions (each as separate input), 
	// RequireAccreditation, Commitment, AgeVerified, JurisdictionVerified, 
	// AccreditationVerified, IdentityVerified, OverallVerified
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
	logEntry := fmt.Sprintf(`{"sessionId":"debug-session","runId":"run1","hypothesisId":"A","location":"circuit.go:229","message":"Starting public inputs construction","data":{"maxJurisdictions":%d,"reqJurisdictionsCount":%d,"computedCommitmentHex":"%s"},"timestamp":%d}`+"\n", maxJurisdictions, len(req.AllowedJurisdictions), padHex(computedCommitment.Text(16)), time.Now().UnixMilli())
	logFile.WriteString(logEntry)
	// #endregion agent log
	
	// Add MinAge
	minAgeHex := padHex(req.MinAge.Int.Text(16))
	publicInputs = append(publicInputs, minAgeHex)
	
	// #region agent log
	logEntry = fmt.Sprintf(`{"sessionId":"debug-session","runId":"run1","hypothesisId":"A","location":"circuit.go:236","message":"Added MinAge","data":{"minAgeHex":"%s","publicInputsCount":%d},"timestamp":%d}`+"\n", minAgeHex, len(publicInputs), time.Now().UnixMilli())
	logFile.WriteString(logEntry)
	// #endregion agent log
	
	// Add ALL 250 AllowedJurisdictions as separate public inputs (matches compiled circuit)
	// The circuit was compiled with 250 jurisdictions, so we must send all 250
	// Use the allowedJurisdictions array that was used in the witness (already padded)
	for i := 0; i < maxJurisdictions; i++ {
		jurisdictionValue, ok := allowedJurisdictions[i].(*big.Int)
		if !ok {
			// Fallback to zero if type assertion fails (shouldn't happen)
			jurisdictionValue = big.NewInt(0)
		}
		jurisdictionHex := padHex(jurisdictionValue.Text(16))
		publicInputs = append(publicInputs, jurisdictionHex)
		if i < 3 || i >= 247 {
			// #region agent log
			logEntry = fmt.Sprintf(`{"sessionId":"debug-session","runId":"run1","hypothesisId":"B","location":"circuit.go:250","message":"Added jurisdiction","data":{"index":%d,"value":"%s","hex":"%s"},"timestamp":%d}`+"\n", i, jurisdictionValue.String(), jurisdictionHex, time.Now().UnixMilli())
			logFile.WriteString(logEntry)
			// #endregion agent log
		}
	}
	
	// #region agent log
	logEntry = fmt.Sprintf(`{"sessionId":"debug-session","runId":"run1","hypothesisId":"A","location":"circuit.go:255","message":"After jurisdictions","data":{"publicInputsCount":%d},"timestamp":%d}`+"\n", len(publicInputs), time.Now().UnixMilli())
	logFile.WriteString(logEntry)
	// #endregion agent log
	
	// Add RequireAccreditation
	requireAccredHex := padHex(req.RequireAccreditation.Int.Text(16))
	publicInputs = append(publicInputs, requireAccredHex)
	
	// Add Commitment (use computed commitment)
	commitmentHex := padHex(computedCommitment.Text(16))
	publicInputs = append(publicInputs, commitmentHex)
	
	// Add public outputs (all computed outputs should be 1 if verification passes)
	// In gnark Groth16, ALL public fields (inputs + outputs) must be in the public witness
	publicInputs = append(publicInputs, padHex(big.NewInt(1).Text(16))) // AgeVerified
	publicInputs = append(publicInputs, padHex(big.NewInt(1).Text(16))) // JurisdictionVerified
	publicInputs = append(publicInputs, padHex(big.NewInt(1).Text(16))) // AccreditationVerified
	publicInputs = append(publicInputs, padHex(big.NewInt(1).Text(16))) // IdentityVerified
	publicInputs = append(publicInputs, padHex(big.NewInt(1).Text(16))) // OverallVerified
	
	// #region agent log
	logEntry = fmt.Sprintf(`{"sessionId":"debug-session","runId":"run1","hypothesisId":"A","location":"circuit.go:278","message":"Final public inputs","data":{"totalCount":%d,"requireAccredHex":"%s","commitmentHex":"%s"},"timestamp":%d}`+"\n", len(publicInputs), requireAccredHex, commitmentHex, time.Now().UnixMilli())
	logFile.WriteString(logEntry)
	// Log sample public inputs for comparison (first 3, last 3)
	sampleInputs := []string{}
	if len(publicInputs) >= 3 {
		sampleInputs = append(sampleInputs, publicInputs[0], publicInputs[1], publicInputs[2])
	}
	if len(publicInputs) >= 6 {
		sampleInputs = append(sampleInputs, publicInputs[len(publicInputs)-3], publicInputs[len(publicInputs)-2], publicInputs[len(publicInputs)-1])
	}
	logEntry2 := fmt.Sprintf(`{"sessionId":"debug-session","runId":"run1","hypothesisId":"D","location":"circuit.go:287","message":"Sample public inputs","data":{"first3":["%s","%s","%s"],"last3":["%s","%s","%s"]},"timestamp":%d}`+"\n", 
		publicInputs[0], publicInputs[1], publicInputs[2], 
		publicInputs[len(publicInputs)-3], publicInputs[len(publicInputs)-2], publicInputs[len(publicInputs)-1],
		time.Now().UnixMilli())
	logFile.WriteString(logEntry2)
	logFile.Close()
	// #endregion agent log
	
	// Note: Verification result outputs (AgeVerified, etc.) are also public outputs
	// but are computed by the circuit, not provided as inputs
	
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

