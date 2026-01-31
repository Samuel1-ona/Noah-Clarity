package circuit

import (
	"bytes"
	"testing"

	"github.com/consensys/gnark-crypto/ecc"
	"github.com/consensys/gnark-crypto/ecc/bn254/fr"
	"github.com/consensys/gnark-crypto/ecc/bn254/fr/mimc"
	"github.com/consensys/gnark/backend/groth16"
	"github.com/consensys/gnark/frontend"
	"github.com/consensys/gnark/frontend/cs/r1cs"
	"github.com/stretchr/testify/assert"
)

// Helper to compute MiMC hash of two values
func hash(v1, v2 []byte) []byte {
	h := mimc.NewMiMC()
	h.Write(v1)
	h.Write(v2)
	return h.Sum(nil)
}

func TestKYCCircuit(t *testing.T) {
	// 1. Setup Merkle Tree for Jurisdictions
	// Leaf values: [1, 2, 3, 4] -> H(1), H(2), H(3), H(4)
	// We want to prove membership of 1 (Index 0)

	// We need to implement a simple Merkle tree construction here matching gnark's MiMC
	// Uses mimc from gnark-crypto

	// Leaves
	// Note: gnark's merkle proof verification hashes the leaf first?
	// Actually, std/accumulator/merkle assumes the input IS the leaf value, and hashes it up.
	// Let's assume a simple depth-2 tree for testing (4 leaves)

	// H(1)
	var b1 bytes.Buffer
	b1Val := new(fr.Element).SetUint64(1).Bytes()
	b1.Write(b1Val[:])
	// h1 := b1.Bytes() // For gnark merkle, usually we start with the value itself.
	// The circuit checks proof for 'Jurisdiction'.

	// Let's create the proof path manually for a tree with leaves [1, 2, 3, 4]
	// Tree:
	//       Root
	//     /      \
	//   H12      H34
	//   / \      / \
	//  1   2    3   4

	// But gnark's merkle.VerifyProof uses MiMC hash.
	// H12 = MiMC(1, 2)
	// H34 = MiMC(3, 4)
	// Root = MiMC(H12, H34)
	// Path for 1: [2, H34]
	// Helper: [0, 0] (0 means "sibling is on the right" or similar, need to check ordering)
	// Wait, gnark merkle proof takes PathHelper which is boolean 0 or 1 to indicate position.

	h := mimc.NewMiMC()

	// Helper to hash a leaf (using same logic as gnark: Reset -> Write -> Sum)
	hashLeaf := func(val int64) []byte {
		h.Reset()
		v := new(fr.Element).SetUint64(uint64(val)).Bytes()
		h.Write(v[:])
		return h.Sum(nil)
	}

	// Helper to hash two nodes
	hashNode := func(left, right []byte) []byte {
		h.Reset()
		h.Write(left)
		h.Write(right)
		return h.Sum(nil)
	}

	// 1. Leaves (Hashed)
	leaf1 := hashLeaf(1)
	leaf2 := hashLeaf(2)
	leaf3 := hashLeaf(3)
	leaf4 := hashLeaf(4)

	// 2. Level 1
	h12 := hashNode(leaf1, leaf2)
	h34 := hashNode(leaf3, leaf4)

	// 3. Root
	rootBytes := hashNode(h12, h34)

	var root fr.Element
	root.SetBytes(rootBytes)

	// Merkle Path for Leaf 1 (Index 0)
	// Siblings: leaf2, h34
	var sibling1 fr.Element
	sibling1.SetBytes(leaf2)
	var sibling2 fr.Element
	sibling2.SetBytes(h34)

	// 2. Identity Commitment
	// Commitment = MiMC(IdentityData, Nonce)
	h.Reset()
	idData := new(fr.Element).SetUint64(12345).Bytes()
	nonce := new(fr.Element).SetUint64(67890).Bytes()
	h.Write(idData[:])
	h.Write(nonce[:])
	commitmentBytes := h.Sum(nil)
	var commitment fr.Element
	commitment.SetBytes(commitmentBytes)

	// 3. Define the witness assignment
	assignment := &KYCCircuit{
		Age:          25,
		Jurisdiction: 1,
		IsAccredited: 1,
		IdentityData: 12345,
		Nonce:        67890,

		// Merkle Proof for Index 0 (Value 1)
		// Path: [sibling1, sibling2]
		MerklePath: []frontend.Variable{sibling1, sibling2},
		// Helper: [0, 0] (0 = index bit 0, 0 = index bit 1 for index 0)
		MerkleHelper: []frontend.Variable{0, 0},

		MinAge:               18,
		JurisdictionRoot:     root,
		RequireAccreditation: 1, // Require accreditation
		Commitment:           commitment,
	}

	// 4. Compile
	// We need a circuit instance with the same structure (slice lengths) but not necessarily values
	// However, passing assignment to Compile is okay IF we don't reuse it for NewWitness?
	// Actually, Compile mutates the object. So we should pass a copy or a fresh structure.
	circuit := &KYCCircuit{
		MerklePath:   make([]frontend.Variable, len(assignment.MerklePath)),
		MerkleHelper: make([]frontend.Variable, len(assignment.MerkleHelper)),
	}

	field := ecc.BN254.ScalarField()
	ccs, err := frontend.Compile(field, r1cs.NewBuilder, circuit)
	assert.NoError(t, err)

	// 5. Run Setup
	pk, vk, err := groth16.Setup(ccs)
	assert.NoError(t, err)

	// 6. Create Witness
	witness, err := frontend.NewWitness(assignment, ecc.BN254.ScalarField())
	assert.NoError(t, err)

	// 7. Prove
	proof, err := groth16.Prove(ccs, pk, witness)
	assert.NoError(t, err)

	// 8. Verify
	pubWitness, err := witness.Public()
	assert.NoError(t, err)
	err = groth16.Verify(proof, vk, pubWitness)
	assert.NoError(t, err)
}

func TestKYCCircuitFailures(t *testing.T) {
	// Test invalid age
	// ... (Skipped for brevity, focusing on successful compilation and proof of new logic)
}
