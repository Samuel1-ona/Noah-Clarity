package main

import (
	"crypto/ecdsa"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"math/big"
	"os"

	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/crypto/secp256k1"
)

// Signer handles ECDSA signature generation using secp256k1
type Signer struct {
	privateKey *ecdsa.PrivateKey
	publicKey  *ecdsa.PublicKey
	attesterID uint
}

// NewSigner creates a new signer from a private key
func NewSigner(privateKeyHex string, attesterID uint) (*Signer, error) {
	privateKey, err := crypto.HexToECDSA(privateKeyHex)
	if err != nil {
		return nil, fmt.Errorf("invalid private key: %w", err)
	}

	publicKey := &privateKey.PublicKey

	return &Signer{
		privateKey: privateKey,
		publicKey:  publicKey,
		attesterID: attesterID,
	}, nil
}

// GenerateKeyPair generates a new secp256k1 key pair
func GenerateKeyPair() (string, string, error) {
	privateKey, err := ecdsa.GenerateKey(secp256k1.S256(), rand.Reader)
	if err != nil {
		return "", "", err
	}

	privateKeyHex := hex.EncodeToString(crypto.FromECDSA(privateKey))
	_ = crypto.FromECDSAPub(&privateKey.PublicKey) // Unused, we use compressed version

	// Compress public key (33 bytes: 0x02 or 0x03 prefix + 32 bytes)
	compressedPubKey := crypto.CompressPubkey(&privateKey.PublicKey)
	publicKeyHex := hex.EncodeToString(compressedPubKey)

	return privateKeyHex, publicKeyHex, nil
}

// Sign signs a message (commitment) and returns the signature
// Returns signature as 65-byte hex string: r (32 bytes) || s (32 bytes) || v (1 byte)
// Uses Keccak256 for Ethereum-compatible signing
func (s *Signer) Sign(message []byte) (string, error) {
	// Hash the message (Keccak256)
	hash := crypto.Keccak256Hash(message)

	// Sign the hash
	signature, err := crypto.Sign(hash.Bytes(), s.privateKey)
	if err != nil {
		return "", fmt.Errorf("signing failed: %w", err)
	}

	// Convert to hex
	return hex.EncodeToString(signature), nil
}

// SignWithSHA256 signs a message hash using SHA256 (for Clarity secp256k1-verify compatibility)
// Clarity's secp256k1-verify expects the signature over the message-hash (SHA256 of original message)
// Since the commitment is already a 32-byte hash, we sign it directly (ECDSA hashes internally)
func (s *Signer) SignWithSHA256(messageHash []byte) (string, error) {
	// #region agent log
	logFile, _ := os.OpenFile("/Users/machine/Documents/Noah-v2/.cursor/debug.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	logEntry1 := fmt.Sprintf(`{"sessionId":"debug-session","runId":"run1","hypothesisId":"A","location":"signer.go:75","message":"SignWithSHA256 entry","data":{"messageHashLen":%d,"messageHashHex":"%s"},"timestamp":%d}`+"\n", len(messageHash), hex.EncodeToString(messageHash), 0)
	logFile.WriteString(logEntry1)
	// #endregion agent log
	
	// Use crypto.Sign from go-ethereum (similar to Ethereum Sign function)
	// crypto.Sign returns 65 bytes: r || s || v, but we need 64 bytes for Clarity
	// crypto.Sign signs the hash directly (doesn't hash again)
	// #region agent log
	logEntry2 := fmt.Sprintf(`{"sessionId":"debug-session","runId":"run1","hypothesisId":"B","location":"signer.go:87","message":"Using crypto.Sign","data":{"commitmentLen":%d,"commitmentHex":"%s"},"timestamp":%d}`+"\n", len(messageHash), hex.EncodeToString(messageHash), 0)
	logFile.WriteString(logEntry2)
	// #endregion agent log

	// Use crypto.Sign (returns 65 bytes: r || s || v)
	signature, err := crypto.Sign(messageHash, s.privateKey)
	if err != nil {
		logFile.Close()
		return "", fmt.Errorf("signing failed: %w", err)
	}

	// Extract r and s (first 64 bytes, discard recovery ID v)
	sigBytes := signature[:64]
	
	// Extract r and s components for low-S normalization
	rBytes := sigBytes[:32]
	sBytes := sigBytes[32:64]
	
	// Get curve order for secp256k1
	curve := secp256k1.S256()
	curveOrder := curve.N
	halfOrder := new(big.Int).Div(curveOrder, big.NewInt(2))
	
	// Parse s value
	sValue := new(big.Int).SetBytes(sBytes)
	
	// Normalize to low-S: if s > curveOrder/2, use curveOrder - s
	var normalizedSBytes []byte
	if sValue.Cmp(halfOrder) > 0 {
		// High-S signature: normalize to low-S
		normalizedS := new(big.Int).Sub(curveOrder, sValue)
		normalizedSBytes = make([]byte, 32)
		normalizedS.FillBytes(normalizedSBytes)
	} else {
		// Already low-S
		normalizedSBytes = sBytes
	}
	
	// Reconstruct signature with normalized s
	normalizedSig := append(rBytes, normalizedSBytes...)
	
	// #region agent log
	logEntry3 := fmt.Sprintf(`{"sessionId":"debug-session","runId":"run1","hypothesisId":"C","location":"signer.go:95","message":"Signature normalization","data":{"originalSLen":%d,"normalizedSLen":%d,"wasHighS":%t,"sHex":"%s","normalizedSHex":"%s"},"timestamp":%d}`+"\n", len(sBytes), len(normalizedSBytes), sValue.Cmp(halfOrder) > 0, hex.EncodeToString(sBytes), hex.EncodeToString(normalizedSBytes), 0)
	logFile.WriteString(logEntry3)
	// #endregion agent log

	// Clarity accepts 64-byte signatures (r || s, no recovery ID) with low-S normalization
	sigHex := hex.EncodeToString(normalizedSig)
	
	// #region agent log
	logEntry4 := fmt.Sprintf(`{"sessionId":"debug-session","runId":"run1","hypothesisId":"D","location":"signer.go:102","message":"Final signature","data":{"sigLen":%d,"sigHex":"%s"},"timestamp":%d}`+"\n", len(normalizedSig), sigHex, 0)
	logFile.WriteString(logEntry4)
	logFile.Close()
	// #endregion agent log
	
	// Return 64-byte signature (Clarity accepts this format)
	return sigHex, nil
}

// SignCommitment signs a commitment hash for Clarity verification
// The commitment is already a 32-byte hash, and Clarity's secp256k1-verify expects
// a signature over the message hash (which it hashes internally with SHA256)
func (s *Signer) SignCommitment(commitment string) (string, error) {
	commitmentBytes, err := hex.DecodeString(commitment)
	if err != nil {
		return "", fmt.Errorf("invalid commitment hex: %w", err)
	}

	if len(commitmentBytes) != 32 {
		return "", fmt.Errorf("commitment must be 32 bytes, got %d", len(commitmentBytes))
	}

	// Use SHA256 to match Clarity's secp256k1-verify
	return s.SignWithSHA256(commitmentBytes)
}

// GetPublicKey returns the compressed public key as hex
func (s *Signer) GetPublicKey() string {
	compressed := crypto.CompressPubkey(s.publicKey)
	return hex.EncodeToString(compressed)
}

// GetAttesterID returns the attester ID
func (s *Signer) GetAttesterID() uint {
	return s.attesterID
}

// VerifySignature verifies a signature (for testing)
func VerifySignature(message []byte, signatureHex string, publicKeyHex string) (bool, error) {
	hash := crypto.Keccak256Hash(message)

	signature, err := hex.DecodeString(signatureHex)
	if err != nil {
		return false, fmt.Errorf("invalid signature hex: %w", err)
	}

	if len(signature) != 65 {
		return false, fmt.Errorf("invalid signature length: expected 65, got %d", len(signature))
	}

	// Remove recovery ID (last byte) for verification
	sigWithoutRecovery := signature[:64]

	publicKeyBytes, err := hex.DecodeString(publicKeyHex)
	if err != nil {
		return false, fmt.Errorf("invalid public key hex: %w", err)
	}

	publicKey, err := crypto.UnmarshalPubkey(publicKeyBytes)
	if err != nil {
		// Try compressed format
		publicKey, err = crypto.DecompressPubkey(publicKeyBytes)
		if err != nil {
			return false, fmt.Errorf("invalid public key: %w", err)
		}
	}

	// Verify signature
	r := new(big.Int).SetBytes(sigWithoutRecovery[:32])
	s := new(big.Int).SetBytes(sigWithoutRecovery[32:64])

	return ecdsa.Verify(publicKey, hash.Bytes(), r, s), nil
}

