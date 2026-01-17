package main

import (
	"math/big"

	"github.com/consensys/gnark-crypto/hash"
)

// computeCommitment computes the MiMC hash of identity data and nonce
// This matches the circuit's commitment computation: MiMC(IdentityData || Nonce)
// MiMC expects field elements (32 bytes for BN254), so we need to pad the input
func computeCommitment(identityData, nonce *big.Int) (*big.Int, error) {
	mimc := hash.MIMC_BN254.New()
	
	// MiMC expects field elements (32 bytes for BN254)
	// Pad identity data to 32 bytes
	identityBytes := make([]byte, 32)
	identityDataBytes := identityData.Bytes()
	copy(identityBytes[32-len(identityDataBytes):], identityDataBytes)
	mimc.Write(identityBytes)
	
	// Pad nonce to 32 bytes
	nonceBytes := make([]byte, 32)
	nonceDataBytes := nonce.Bytes()
	copy(nonceBytes[32-len(nonceDataBytes):], nonceDataBytes)
	mimc.Write(nonceBytes)
	
	// Compute hash
	hashBytes := mimc.Sum(nil)
	
	// Convert to big.Int
	commitment := new(big.Int).SetBytes(hashBytes)
	
	return commitment, nil
}
