package main

import (
	"fmt"
)

// RevocationService manages credential revocation
type RevocationService struct {
	merkleTree *MerkleTree
	revoked    map[string]bool
}

// NewRevocationService creates a new revocation service
func NewRevocationService() *RevocationService {
	return &RevocationService{
		merkleTree: NewMerkleTree([]string{}),
		revoked:    make(map[string]bool),
	}
}

// RevokeCredential revokes a credential by adding it to the revocation tree
func (rs *RevocationService) RevokeCredential(commitment string) error {
	if rs.revoked[commitment] {
		return fmt.Errorf("credential already revoked")
	}

	rs.revoked[commitment] = true
	rs.merkleTree.AddCommitment(commitment)

	return nil
}

// IsRevoked checks if a commitment is revoked
func (rs *RevocationService) IsRevoked(commitment string) bool {
	return rs.revoked[commitment]
}

// GetRevocationRoot returns the current Merkle root of revoked credentials
func (rs *RevocationService) GetRevocationRoot() string {
	return rs.merkleTree.GetRoot()
}

// GenerateNonRevocationProof generates a proof that a commitment is NOT in the revocation tree
func (rs *RevocationService) GenerateNonRevocationProof(commitment string) ([]string, []bool, error) {
	// If the commitment is revoked, we can't generate a non-revocation proof
	if rs.IsRevoked(commitment) {
		return nil, nil, fmt.Errorf("credential is revoked")
	}

	// Generate Merkle proof for non-membership
	// This uses the Merkle tree to generate a proof path showing the commitment is not in the tree
	proof, path, err := rs.merkleTree.GenerateProof(commitment)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to generate proof: %w", err)
	}

	// Return the proof path and direction indicators
	// The proof path contains sibling hashes, and path indicates left/right direction
	return proof, path, nil
}

// GetRevokedCount returns the number of revoked credentials
func (rs *RevocationService) GetRevokedCount() int {
	return len(rs.revoked)
}

