package main

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
)

// MerkleTree represents a Merkle tree for revocation lists
type MerkleTree struct {
	leaves []string
	root   string
}

// NewMerkleTree creates a new Merkle tree from a list of commitments
func NewMerkleTree(commitments []string) *MerkleTree {
	if len(commitments) == 0 {
		return &MerkleTree{
			leaves: []string{},
			root:   "0x0000000000000000000000000000000000000000000000000000000000000000",
		}
	}

	// Hash all leaves
	hashedLeaves := make([]string, len(commitments))
	for i, commitment := range commitments {
		hashedLeaves[i] = hashCommitment(commitment)
	}

	// Build tree
	root := buildMerkleTree(hashedLeaves)

	return &MerkleTree{
		leaves: commitments,
		root:   root,
	}
}

// GetRoot returns the Merkle root
func (mt *MerkleTree) GetRoot() string {
	return mt.root
}

// AddCommitment adds a commitment to the tree and updates the root
func (mt *MerkleTree) AddCommitment(commitment string) {
	mt.leaves = append(mt.leaves, commitment)
	hashedLeaves := make([]string, len(mt.leaves))
	for i, c := range mt.leaves {
		hashedLeaves[i] = hashCommitment(c)
	}
	mt.root = buildMerkleTree(hashedLeaves)
}

// GenerateProof generates a Merkle proof for a commitment
func (mt *MerkleTree) GenerateProof(commitment string) ([]string, []bool, error) {
	_ = hashCommitment(commitment) // Hash the commitment for lookup

	// Find index of commitment
	index := -1
	hashedLeaves := make([]string, len(mt.leaves))
	for i, c := range mt.leaves {
		hashedLeaves[i] = hashCommitment(c)
		if c == commitment {
			index = i
		}
	}

	if index == -1 {
		return nil, nil, fmt.Errorf("commitment not found in tree")
	}

	// Generate proof path
	proof := []string{}
	proofIndices := []bool{}
	currentLevel := hashedLeaves
	currentIndex := index

	for len(currentLevel) > 1 {
		siblingIndex := currentIndex ^ 1
		if siblingIndex < len(currentLevel) {
			proof = append(proof, currentLevel[siblingIndex])
			proofIndices = append(proofIndices, currentIndex%2 == 0)
		} else {
			// Odd number of nodes, duplicate the last one
			proof = append(proof, currentLevel[len(currentLevel)-1])
			proofIndices = append(proofIndices, true)
		}

		// Move to next level
		nextLevel := []string{}
		for i := 0; i < len(currentLevel); i += 2 {
			if i+1 < len(currentLevel) {
				nextLevel = append(nextLevel, hashPair(currentLevel[i], currentLevel[i+1]))
			} else {
				nextLevel = append(nextLevel, hashPair(currentLevel[i], currentLevel[i]))
			}
		}
		currentLevel = nextLevel
		currentIndex = currentIndex / 2
	}

	return proof, proofIndices, nil
}

// VerifyProof verifies a Merkle proof
func VerifyProof(commitment string, proof []string, proofIndices []bool, root string) bool {
	if len(proof) != len(proofIndices) {
		return false
	}

	currentHash := hashCommitment(commitment)

	for i, siblingHash := range proof {
		if proofIndices[i] {
			// Sibling is on the right
			currentHash = hashPair(currentHash, siblingHash)
		} else {
			// Sibling is on the left
			currentHash = hashPair(siblingHash, currentHash)
		}
	}

	return currentHash == root
}

// hashCommitment hashes a commitment
func hashCommitment(commitment string) string {
	// Remove 0x prefix if present
	if len(commitment) > 2 && commitment[:2] == "0x" {
		commitment = commitment[2:]
	}

	bytes, err := hex.DecodeString(commitment)
	if err != nil {
		// If not hex, treat as string
		bytes = []byte(commitment)
	}

	hash := sha256.Sum256(bytes)
	return hex.EncodeToString(hash[:])
}

// hashPair hashes two hashes together
func hashPair(left, right string) string {
	leftBytes, _ := hex.DecodeString(left)
	rightBytes, _ := hex.DecodeString(right)

	combined := append(leftBytes, rightBytes...)
	hash := sha256.Sum256(combined)
	return hex.EncodeToString(hash[:])
}

// buildMerkleTree builds a Merkle tree and returns the root
func buildMerkleTree(leaves []string) string {
	if len(leaves) == 0 {
		return "0x0000000000000000000000000000000000000000000000000000000000000000"
	}

	if len(leaves) == 1 {
		return leaves[0]
	}

	currentLevel := leaves
	for len(currentLevel) > 1 {
		nextLevel := []string{}
		for i := 0; i < len(currentLevel); i += 2 {
			if i+1 < len(currentLevel) {
				nextLevel = append(nextLevel, hashPair(currentLevel[i], currentLevel[i+1]))
			} else {
				// Odd number, duplicate last node
				nextLevel = append(nextLevel, hashPair(currentLevel[i], currentLevel[i]))
			}
		}
		currentLevel = nextLevel
	}

	return currentLevel[0]
}

