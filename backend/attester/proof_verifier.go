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
	// Must match the prover's compilation with 250 jurisdictions
	maxJurisdictions := 250
	allowedJurisdictions := make([]frontend.Variable, maxJurisdictions)
	for i := range allowedJurisdictions {
		allowedJurisdictions[i] = 0 // Placeholder values for compilation
	}
	
	kycCircuit := &circuit.KYCCircuit{
		MinAge:               0, // Placeholder for compilation
		AllowedJurisdictions: allowedJurisdictions,
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
// Public inputs order: MinAge, AllowedJurisdictions..., RequireAccreditation, Commitment
func (pv *ProofVerifier) reconstructPublicWitness(publicInputs []string) (*circuit.KYCCircuit, error) {
	// #region agent log
	logFile, _ := os.OpenFile("/Users/machine/Documents/Noah-v2/.cursor/debug.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	logEntry := fmt.Sprintf(`{"sessionId":"debug-session","runId":"run1","hypothesisId":"A","location":"proof_verifier.go:150","message":"Reconstructing witness","data":{"publicInputsCount":%d,"firstInput":"%s","lastInput":"%s"},"timestamp":%d}`+"\n", len(publicInputs), publicInputs[0], publicInputs[len(publicInputs)-1], time.Now().UnixMilli())
	logFile.WriteString(logEntry)
	// #endregion agent log
	
	if len(publicInputs) < 4 {
		logFile.Close()
		return nil, fmt.Errorf("insufficient public inputs: expected at least 4, got %d", len(publicInputs))
	}

	// Parse MinAge (first input)
	minAgeBytes, err := hex.DecodeString(publicInputs[0])
	if err != nil {
		logFile.Close()
		return nil, fmt.Errorf("invalid MinAge hex: %w", err)
	}
	minAge := new(big.Int).SetBytes(minAgeBytes)

	// Parse AllowedJurisdictions
	// Public inputs structure: [MinAge, ...250 Jurisdictions..., RequireAccreditation, Commitment, AgeVerified, JurisdictionVerified, AccreditationVerified, IdentityVerified, OverallVerified]
	// The circuit was compiled with maxJurisdictions = 250, so we expect exactly 250 jurisdiction inputs
	// Plus 5 public outputs (all verification results)
	maxJurisdictions := 250 // Must match the circuit compilation
	expectedTotalInputs := 1 + maxJurisdictions + 2 + 5 // MinAge + 250 Jurisdictions + RequireAccreditation + Commitment + 5 outputs
	
	// #region agent log
	logEntry2 := fmt.Sprintf(`{"sessionId":"debug-session","runId":"run1","hypothesisId":"A","location":"proof_verifier.go:157","message":"Checking input count","data":{"expected":%d,"got":%d,"minAgeHex":"%s"},"timestamp":%d}`+"\n", expectedTotalInputs, len(publicInputs), publicInputs[0], time.Now().UnixMilli())
	logFile.WriteString(logEntry2)
	// #endregion agent log
	
	if len(publicInputs) != expectedTotalInputs {
		logFile.Close()
		return nil, fmt.Errorf("invalid public inputs: expected %d inputs (1 MinAge + 250 Jurisdictions + 1 RequireAccreditation + 1 Commitment + 5 outputs), got %d", expectedTotalInputs, len(publicInputs))
	}
	
	// Create array with maxJurisdictions size (matches compiled circuit)
	allowedJurisdictions := make([]frontend.Variable, maxJurisdictions)
	
	// Parse all 250 jurisdictions from public inputs
	for i := 0; i < maxJurisdictions; i++ {
		jBytes, err := hex.DecodeString(publicInputs[1+i])
		if err != nil {
			logFile.Close()
			return nil, fmt.Errorf("invalid jurisdiction %d hex: %w", i, err)
		}
		jurisdictionValue := new(big.Int).SetBytes(jBytes)
		allowedJurisdictions[i] = jurisdictionValue
		if i < 3 || i >= 247 {
			// #region agent log
			logEntry3 := fmt.Sprintf(`{"sessionId":"debug-session","runId":"run1","hypothesisId":"B","location":"proof_verifier.go:172","message":"Parsed jurisdiction","data":{"index":%d,"value":"%s","hex":"%s"},"timestamp":%d}`+"\n", i, jurisdictionValue.String(), publicInputs[1+i], time.Now().UnixMilli())
			logFile.WriteString(logEntry3)
			// #endregion agent log
		}
	}

	// Parse RequireAccreditation (before Commitment, which is before the 5 outputs)
	requireAccredIndex := len(publicInputs) - 7 // 5 outputs + 1 Commitment before RequireAccreditation
	requireAccredBytes, err := hex.DecodeString(publicInputs[requireAccredIndex])
	if err != nil {
		logFile.Close()
		return nil, fmt.Errorf("invalid RequireAccreditation hex: %w", err)
	}
	requireAccred := new(big.Int).SetBytes(requireAccredBytes)
	
	// #region agent log
	logEntry4 := fmt.Sprintf(`{"sessionId":"debug-session","runId":"run1","hypothesisId":"C","location":"proof_verifier.go:227","message":"Parsed RequireAccreditation","data":{"value":"%s","hex":"%s"},"timestamp":%d}`+"\n", requireAccred.String(), publicInputs[requireAccredIndex], time.Now().UnixMilli())
	logFile.WriteString(logEntry4)
	// #endregion agent log

	// Parse Commitment (second to last input, before the 5 outputs)
	commitmentIndex := len(publicInputs) - 6 // Last 5 are outputs
	commitmentBytes, err := hex.DecodeString(publicInputs[commitmentIndex])
	if err != nil {
		logFile.Close()
		return nil, fmt.Errorf("invalid Commitment hex: %w", err)
	}
	commitment := new(big.Int).SetBytes(commitmentBytes)
	
	// Parse public outputs (last 5 inputs)
	parseOutput := func(index int, name string) (*big.Int, error) {
		bytes, err := hex.DecodeString(publicInputs[index])
		if err != nil {
			return nil, fmt.Errorf("invalid %s hex: %w", name, err)
		}
		return new(big.Int).SetBytes(bytes), nil
	}
	
	ageVerified, err := parseOutput(len(publicInputs)-5, "AgeVerified")
	if err != nil {
		logFile.Close()
		return nil, err
	}
	jurisdictionVerified, err := parseOutput(len(publicInputs)-4, "JurisdictionVerified")
	if err != nil {
		logFile.Close()
		return nil, err
	}
	accreditationVerified, err := parseOutput(len(publicInputs)-3, "AccreditationVerified")
	if err != nil {
		logFile.Close()
		return nil, err
	}
	identityVerified, err := parseOutput(len(publicInputs)-2, "IdentityVerified")
	if err != nil {
		logFile.Close()
		return nil, err
	}
	overallVerified, err := parseOutput(len(publicInputs)-1, "OverallVerified")
	if err != nil {
		logFile.Close()
		return nil, err
	}
	
	// #region agent log
	logEntry5 := fmt.Sprintf(`{"sessionId":"debug-session","runId":"run1","hypothesisId":"C","location":"proof_verifier.go:218","message":"Parsed Commitment","data":{"value":"%s","hex":"%s","hexLength":%d},"timestamp":%d}`+"\n", commitment.String(), publicInputs[commitmentIndex], len(publicInputs[commitmentIndex]), time.Now().UnixMilli())
	logFile.WriteString(logEntry5)
	// Log parsed minAge for comparison
	logEntryMinAge := fmt.Sprintf(`{"sessionId":"debug-session","runId":"run1","hypothesisId":"D","location":"proof_verifier.go:222","message":"Parsed MinAge","data":{"value":"%s","hex":"%s","hexLength":%d},"timestamp":%d}`+"\n", minAge.String(), publicInputs[0], len(publicInputs[0]), time.Now().UnixMilli())
	logFile.WriteString(logEntryMinAge)
	// #endregion agent log

	// Create circuit structure with public input fields set
	// Output fields are parsed from public inputs (they're part of the public witness in gnark Groth16)
	// #region agent log
	logEntry6 := fmt.Sprintf(`{"sessionId":"debug-session","runId":"run1","hypothesisId":"A","location":"proof_verifier.go:250","message":"Creating witness structure","data":{"minAge":"%s","jurisdictionsCount":%d,"requireAccred":"%s","commitment":"%s","outputs":"%s,%s,%s,%s,%s"},"timestamp":%d}`+"\n", minAge.String(), len(allowedJurisdictions), requireAccred.String(), commitment.String(), ageVerified.String(), jurisdictionVerified.String(), accreditationVerified.String(), identityVerified.String(), overallVerified.String(), time.Now().UnixMilli())
	logFile.WriteString(logEntry6)
	logFile.Close()
	// #endregion agent log
	return &circuit.KYCCircuit{
		MinAge:               minAge,
		AllowedJurisdictions: allowedJurisdictions,
		RequireAccreditation: requireAccred,
		Commitment:           commitment,
		// Public output fields parsed from inputs
		AgeVerified:           ageVerified,
		JurisdictionVerified:  jurisdictionVerified,
		AccreditationVerified: accreditationVerified,
		IdentityVerified:      identityVerified,
		OverallVerified:       overallVerified,
	}, nil
}

