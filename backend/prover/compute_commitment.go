package main

import (
	"math/big"

	"github.com/consensys/gnark-crypto/hash"
)

// computeCommitment computes the MiMC hash of identity data, nonce, and user address
// This matches the circuit's commitment computation: MiMC(IdentityData || Nonce || UserAddress)
// MiMC expects field elements (32 bytes for BN254), so we need to pad the input
func computeCommitment(identityData, nonce, userAddress *big.Int) (*big.Int, error) {
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

	// Pad userAddress to 32 bytes
	addrBytes := make([]byte, 32)
	addrDataBytes := userAddress.Bytes()
	copy(addrBytes[32-len(addrDataBytes):], addrDataBytes)
	mimc.Write(addrBytes)

	// Compute hash
	hashBytes := mimc.Sum(nil)

	// Convert to big.Int
	commitment := new(big.Int).SetBytes(hashBytes)

	return commitment, nil
}
