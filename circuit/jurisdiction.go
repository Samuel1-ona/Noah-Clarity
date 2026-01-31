package circuit

import (
	"github.com/consensys/gnark/frontend"
	"github.com/consensys/gnark/std/accumulator/merkle"
	"github.com/consensys/gnark/std/hash/mimc"
)

// JurisdictionCircuit verifies that a user's jurisdiction is in an allowed list
// without revealing the actual jurisdiction
// Optimized: Uses Merkle proofs instead of linear scan for unlimited scalability
type JurisdictionCircuit struct {
	// Private inputs
	Jurisdiction frontend.Variable `gnark:",secret"` // Encoded jurisdiction ID

	// Merkle Proof for Jurisdiction (Private)
	// Path and Helper vars are needed for Merkle proof verification
	MerklePath   []frontend.Variable `gnark:",secret"`
	MerkleHelper []frontend.Variable `gnark:",secret"`

	// Public inputs
	JurisdictionRoot frontend.Variable `gnark:",public"` // Root of allowed jurisdictions tree
}

// Define declares the circuit constraints
func (circuit *JurisdictionCircuit) Define(api frontend.API) error {
	// Verify jurisdiction using Merkle proof
	// This allows unlimited jurisdictions without increasing circuit size

	mimcHash, err := mimc.NewMiMC(api)
	if err != nil {
		return err
	}

	// Construct the full path (Jurisdiction + Siblings)
	fullPath := make([]frontend.Variable, len(circuit.MerklePath)+1)
	fullPath[0] = circuit.Jurisdiction
	copy(fullPath[1:], circuit.MerklePath)

	// Reconstruct the leaf index from MerkleHelper bits (Little Endian)
	leafIndex := frontend.Variable(0)
	power := 1
	for _, bit := range circuit.MerkleHelper {
		leafIndex = api.Add(leafIndex, api.Mul(bit, power))
		power <<= 1
	}

	merkleProof := merkle.MerkleProof{
		RootHash: circuit.JurisdictionRoot,
		Path:     fullPath,
	}

	// VerifyProof asserts that the jurisdiction is a valid leaf in the tree
	merkleProof.VerifyProof(api, &mimcHash, leafIndex)

	return nil
}

// JurisdictionCheck verifies if a jurisdiction is in the allowed tree using Merkle proof
// This is a helper function that performs the same verification
func JurisdictionCheck(api frontend.API, jurisdiction frontend.Variable, merklePath, merkleHelper []frontend.Variable, root frontend.Variable) error {
	mimcHash, err := mimc.NewMiMC(api)
	if err != nil {
		return err
	}

	// Construct the full path
	fullPath := make([]frontend.Variable, len(merklePath)+1)
	fullPath[0] = jurisdiction
	copy(fullPath[1:], merklePath)

	// Reconstruct leaf index
	leafIndex := frontend.Variable(0)
	power := 1
	for _, bit := range merkleHelper {
		leafIndex = api.Add(leafIndex, api.Mul(bit, power))
		power <<= 1
	}

	merkleProof := merkle.MerkleProof{
		RootHash: root,
		Path:     fullPath,
	}

	merkleProof.VerifyProof(api, &mimcHash, leafIndex)
	return nil
}
