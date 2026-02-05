package main

import (
	"crypto/ecdsa"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/crypto/secp256k1"

	"github.com/consensys/gnark-crypto/ecc/bn254/fr/mimc"
	"github.com/consensys/gnark-crypto/ecc/bn254/twistededwards/eddsa"
)

// Signer handles ECDSA signature generation using secp256k1
type Signer struct {
	privateKey      *ecdsa.PrivateKey
	publicKey       *ecdsa.PublicKey
	eddsaPrivateKey *eddsa.PrivateKey
	attesterID      uint
}

// NewSigner creates a new signer from a private key
func NewSigner(privateKeyHex string, attesterID uint) (*Signer, error) {
	privateKey, err := crypto.HexToECDSA(privateKeyHex)
	if err != nil {
		return nil, fmt.Errorf("invalid private key: %w", err)
	}

	publicKey := &privateKey.PublicKey

	// Initialize EdDSA key for BN254 (Baby-Jubjub)
	// For production, this should be loaded from a separate EdDSA key file or derived from a seed.
	eddsaPriv, err := eddsa.GenerateKey(rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("failed to generate EdDSA key: %w", err)
	}

	return &Signer{
		privateKey:      privateKey,
		publicKey:       publicKey,
		eddsaPrivateKey: eddsaPriv,
		attesterID:      attesterID,
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

// SignEdDSA signs a commitment hash using EdDSA (Baby-Jubjub) for ZK-friendly verification
// The commitment should be a 32-byte hash (MiMC)
func (s *Signer) SignEdDSA(commitment []byte) (eddsa.Signature, error) {
	// Sign requires a hash function for Fiat-Shamir
	hFunc := mimc.NewMiMC()

	signatureBytes, err := s.eddsaPrivateKey.Sign(commitment, hFunc)
	if err != nil {
		return eddsa.Signature{}, fmt.Errorf("EdDSA signing failed: %w", err)
	}

	var sig eddsa.Signature
	_, err = sig.SetBytes(signatureBytes)
	if err != nil {
		return eddsa.Signature{}, fmt.Errorf("failed to parse EdDSA signature: %w", err)
	}

	return sig, nil
}

// GetEdDSAPublicKey returns the EdDSA public key for circuit verification
func (s *Signer) GetEdDSAPublicKey() eddsa.PublicKey {
	return s.eddsaPrivateKey.PublicKey
}

// SignWithSHA256 signs a message hash using SHA256 (for Clarity secp256k1-verify compatibility)
// Clarity's secp256k1-verify expects the signature over the message-hash (SHA256 of original message)
// Since the commitment is already a 32-byte hash, we sign it directly (ECDSA hashes internally)
func (s *Signer) SignWithSHA256(messageHash []byte) (string, error) {

	// Use crypto.Sign (returns 65 bytes: r || s || v)
	signature, err := crypto.Sign(messageHash, s.privateKey)
	if err != nil {
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

	// Clarity accepts 64-byte signatures (r || s, no recovery ID) with low-S normalization
	sigHex := hex.EncodeToString(normalizedSig)

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

// GetStacksAddress returns the Stacks address for this signer
// Note: In production this would use the stacks-go library to derive the address
// For now, we return it as a string if we had it, or just use a placeholder/not implemented
// Actually, since we don't have the stacks-go library here, we'll just not add it to avoid confusion
// unless we strictly need it. The frontend can handle it if the user knows their address.

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
