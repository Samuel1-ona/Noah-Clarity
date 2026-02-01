package main

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"
	"time"

	"noah-v2/backend/pkg/logger"

	"github.com/consensys/gnark-crypto/ecc/bn254/fr/mimc"
	"go.uber.org/zap"
)

// IssuerService handles credential issuance
type IssuerService struct {
	signer            *Signer
	store             *Store
	revocationService *RevocationService
	credentials       map[string]*Credential
	verifier          *ProofVerifier
	config            *Config
}

// NewIssuerService creates a new issuer service
func NewIssuerService(signer *Signer) *IssuerService {
	config := LoadConfig()
	verifier := NewProofVerifier(config.VerifyingKeyPath)
	store, err := NewStore(config.DBType, config.DBDSN)
	if err != nil {
		fmt.Printf("Warning: Failed to initialize database store: %v\n", err)
	}
	revocation := NewRevocationService()
	return &IssuerService{
		signer:            signer,
		store:             store,
		revocationService: revocation,
		credentials:       make(map[string]*Credential),
		verifier:          verifier,
		config:            config,
	}
}

// IssueCredential issues a new credential to a user
func (is *IssuerService) IssueCredential(req *CredentialRequest) (*Credential, error) {
	// 1. Generate Identity Fingerprint (Nullifier)
	if len(req.Documents) == 0 {
		return nil, fmt.Errorf("at least one document is required")
	}
	fingerprint := is.generateIdentityFingerprint(req.Documents[0])

	// 2. Sybil Check: Has this document been used by another address?
	if existingAddr, exists := is.store.GetAddress(fingerprint); exists {
		if existingAddr != req.UserAddress {
			// Check if previous commitment is revoked
			oldCommit, _ := is.store.GetCommitment(existingAddr)
			if !is.revocationService.IsRevoked(oldCommit) {
				return nil, fmt.Errorf("this identity is already registered with address %s. Revoke it first to migrate", existingAddr)
			}
		}
	}

	// 3. Generate or use user-provided commitment
	var commitment string
	if req.UserCommitment != "" {
		commitment = req.UserCommitment
		logger.Debug("Using user-provided commitment", zap.String("user_id", req.UserID))
	} else {
		var err error
		commitment, err = is.generateCommitment(req)
		if err != nil {
			return nil, fmt.Errorf("failed to generate commitment: %w", err)
		}
	}

	// 3.5 Sign the commitment
	commitmentBytes, _ := hex.DecodeString(strings.TrimPrefix(commitment, "0x"))

	// ECDSA for Clarity
	ecdsaSig, err := is.signer.SignCommitment(hex.EncodeToString(commitmentBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to sign ECDSA: %w", err)
	}

	// EdDSA for ZK
	eddsaSig, err := is.signer.SignEdDSA(commitmentBytes)
	if err != nil {
		return nil, fmt.Errorf("failed to sign EdDSA: %w", err)
	}

	eddsaPub := is.signer.GetEdDSAPublicKey()

	// Convert EdDSA types to JSON-friendly format
	var sBig big.Int
	sBig.SetBytes(eddsaSig.S[:])

	// Create credential
	credential := &Credential{
		UserID:     req.UserID,
		Attributes: req.Attributes,
		Commitment: commitment,
		Signature:  ecdsaSig,
		EdDSASignature: EdDSASignature{
			R: Point{
				X: eddsaSig.R.X.String(),
				Y: eddsaSig.R.Y.String(),
			},
			S: sBig.String(),
		},
		AttesterPublicKey: EdDSAPublicKey{
			A: Point{
				X: eddsaPub.A.X.String(),
				Y: eddsaPub.A.Y.String(),
			},
		},
		IssuedAt:   time.Now().Unix(),
		ExpiresAt:  time.Now().Add(365 * 24 * time.Hour).Unix(),
		AttesterID: is.signer.GetAttesterID(),
	}

	// 4. Update Store
	is.store.SetIdentity(fingerprint, req.UserAddress)
	is.store.SetCommitment(req.UserAddress, commitment)
	_ = is.store.Save()

	// Store in-memory for quick access
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

// generateCommitment generates a MiMC commitment hash locked to user address
func (is *IssuerService) generateCommitment(req *CredentialRequest) (string, error) {
	// Parse inputs into big.Int for MiMC
	idData := new(big.Int)
	if req.IdentityData != "" {
		idData.SetString(req.IdentityData, 0)
	} else {
		idData.SetInt64(0)
	}

	nonce := new(big.Int)
	if req.Nonce != "" {
		nonce.SetString(req.Nonce, 0)
	} else {
		nonce.SetInt64(0)
	}

	addr := new(big.Int)
	// If address is hex, parse it, otherwise use hash
	if strings.HasPrefix(req.UserAddress, "0x") {
		addr.SetString(req.UserAddress, 0)
	} else {
		// Fallback for non-hex addresses (e.g. Stacks principal)
		// We hash it to fit in a field element
		h := sha256.Sum256([]byte(req.UserAddress))
		addr.SetBytes(h[:])
	}

	hashFunc := mimc.NewMiMC()
	hashFunc.Write(idData.Bytes())
	hashFunc.Write(nonce.Bytes())
	hashFunc.Write(addr.Bytes())

	result := hashFunc.Sum(nil)
	return "0x" + hex.EncodeToString(result), nil
}

// generateIdentityFingerprint creates a unique, private hash for a document
func (is *IssuerService) generateIdentityFingerprint(doc DocumentInfo) string {
	raw := fmt.Sprintf("%s:%s:%s", doc.Type, doc.Number, doc.Country)
	hash := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(hash[:])
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
