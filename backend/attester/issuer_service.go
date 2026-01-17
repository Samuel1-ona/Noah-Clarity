package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"
)

// IssuerService handles credential issuance
type IssuerService struct {
	signer      *Signer
	credentials map[string]*Credential
	verifier    *ProofVerifier
	config      *Config
}

// NewIssuerService creates a new issuer service
func NewIssuerService(signer *Signer) *IssuerService {
	config := LoadConfig()
	verifier := NewProofVerifier(config.VerifyingKeyPath)
	return &IssuerService{
		signer:      signer,
		credentials: make(map[string]*Credential),
		verifier:    verifier,
		config:      config,
	}
}

// IssueCredential issues a new credential to a user
func (is *IssuerService) IssueCredential(req *CredentialRequest) (*Credential, error) {
	// In a real implementation, this would:
	// 1. Verify user identity documents
	// 2. Perform KYC checks
	// 3. Generate a commitment from the credential data

	// Generate commitment from credential data
	commitment, err := is.generateCommitment(req)
	if err != nil {
		return nil, fmt.Errorf("failed to generate commitment: %w", err)
	}

	// Create credential
	credential := &Credential{
		UserID:     req.UserID,
		Attributes: req.Attributes,
		Commitment: commitment,
		IssuedAt:   time.Now().Unix(),
		ExpiresAt:  time.Now().Add(365 * 24 * time.Hour).Unix(), // 1 year expiry
		AttesterID: is.signer.GetAttesterID(),
	}

	// Store credential
	is.credentials[req.UserID] = credential

	return credential, nil
}

// GetCredential retrieves a credential by user ID
func (is *IssuerService) GetCredential(userID string) (*Credential, error) {
	credential, exists := is.credentials[userID]
	if !exists {
		return nil, fmt.Errorf("credential not found for user: %s", userID)
	}
	return credential, nil
}

// generateCommitment generates a commitment hash from credential data
func (is *IssuerService) generateCommitment(req *CredentialRequest) (string, error) {
	// Serialize credential data
	data, err := json.Marshal(req.Attributes)
	if err != nil {
		return "", err
	}

	// Add user ID
	data = append(data, []byte(req.UserID)...)

	// Hash the data
	hash := sha256.Sum256(data)
	return hex.EncodeToString(hash[:]), nil
}

// VerifyProof verifies a ZK proof using groth16.Verify
func (is *IssuerService) VerifyProof(proof string, publicInputs []string) (bool, error) {
	// Basic validation
	if proof == "" || len(publicInputs) == 0 {
		return false, fmt.Errorf("invalid proof or public inputs")
	}

	// Use the proof verifier to perform actual cryptographic verification
	return is.verifier.VerifyProof(proof, publicInputs)
}

// CreateAttestation creates an attestation signature for a proof
func (is *IssuerService) CreateAttestation(req *AttestationRequest) (*AttestationResponse, error) {
	// Verify the proof first
	verified, err := is.VerifyProof(req.Proof, req.PublicInputs)
	if !verified || err != nil {
		return &AttestationResponse{
			Success: false,
			Error:   "Proof verification failed",
		}, fmt.Errorf("proof verification failed: %w", err)
	}

	// Sign the commitment
	signature, err := is.signer.SignCommitment(req.Commitment)
	if err != nil {
		return &AttestationResponse{
			Success: false,
			Error:   "Signature generation failed",
		}, fmt.Errorf("failed to sign commitment: %w", err)
	}

	// Calculate expiry (1 year from now, in block height approximation)
	// In production, use actual block height from Stacks
	expiry := uint64(time.Now().Add(365 * 24 * time.Hour).Unix())

	return &AttestationResponse{
		Commitment: req.Commitment,
		Signature:  signature,
		AttesterID: is.signer.GetAttesterID(),
		Expiry:     expiry,
		Success:    true,
	}, nil
}

