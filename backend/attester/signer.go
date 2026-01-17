package main

import (
	"crypto/ecdsa"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"math/big"

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

// SignCommitment signs a commitment hash
func (s *Signer) SignCommitment(commitment string) (string, error) {
	commitmentBytes, err := hex.DecodeString(commitment)
	if err != nil {
		return "", fmt.Errorf("invalid commitment hex: %w", err)
	}

	return s.Sign(commitmentBytes)
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

