package circuit

import (
	"github.com/consensys/gnark/frontend"
	"github.com/consensys/gnark/std/accumulator/merkle"
	"github.com/consensys/gnark/std/hash/mimc"
)

// KYCCircuit is the main circuit that combines all KYC checks
// It verifies age, jurisdiction, accreditation, and identity without revealing private data
// Optimized: Uses Merkle Proofs for jurisdiction and direct assertions to reduce constraints
type KYCCircuit struct {
	// Private inputs (witness)
	Age          frontend.Variable `gnark:",secret"`
	Jurisdiction frontend.Variable `gnark:",secret"`
	IsAccredited frontend.Variable `gnark:",secret"` // 1 if accredited, 0 otherwise
	IdentityData frontend.Variable `gnark:",secret"`
	Nonce        frontend.Variable `gnark:",secret"`

	// Merkle Proof for Jurisdiction (Private)
	// Path and Helper vars are needed for Merkle proof verification
	// Size depends on tree depth, let's assume depth 20 for global jurisdiction lists
	MerklePath   []frontend.Variable `gnark:",secret"`
	MerkleHelper []frontend.Variable `gnark:",secret"`

	// Public inputs
	MinAge               frontend.Variable `gnark:",public"`
	JurisdictionRoot     frontend.Variable `gnark:",public"` // Root of allowed jurisdictions tree
	RequireAccreditation frontend.Variable `gnark:",public"` // 1 if accreditation required, 0 otherwise
	Commitment           frontend.Variable `gnark:",public"`
}

// Define declares the circuit constraints
func (circuit *KYCCircuit) Define(api frontend.API) error {
	// 1. Age Verify
	// Constraint: Age >= MinAge
	api.AssertIsLessOrEqual(circuit.MinAge, circuit.Age)

	// 2. Jurisdiction Verification (Merkle Proof)
	// Check if circuit.Jurisdiction is a leaf in the tree with root circuit.JurisdictionRoot
	// We use MiMC as the hash function for the Merkle tree
	mimcHash, err := mimc.NewMiMC(api)
	if err != nil {
		return err
	}

	// Verify proof
	// Gnark's std/accumulator/merkle logic:
	// - Path[0] is the leaf value
	// - Path[1:] are the siblings
	// - VerifyProof takes the leaf INDEX as argument
	// - RootHash must be set in the struct

	// 1. Construct the full path (Jurisdiction + Siblings)
	fullPath := make([]frontend.Variable, len(circuit.MerklePath)+1)
	fullPath[0] = circuit.Jurisdiction
	copy(fullPath[1:], circuit.MerklePath)

	// 2. Reconstruct the leaf index from MerkleHelper bits
	// MerkleHelper contains the bit decomposition of the index (Little Endian)
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

	// VerifyProof asserts that the leaf at leafIndex in the tree with RootHash
	// has the value specified in merkleProof.Path[0] (which is circuit.Jurisdiction)
	merkleProof.VerifyProof(api, &mimcHash, leafIndex)

	// 3. Accreditation Verification
	// If RequireAccreditation is 1, IsAccredited must be 1.
	// Implementation: Assert (RequireAccreditation * (1 - IsAccredited)) == 0
	// Cases:
	// - Req=0: 0 * ... = 0 (Check passes, IsAccredited can be 0 or 1)
	// - Req=1, Is=1: 1 * (1-1) = 0 (Check passes)
	// - Req=1, Is=0: 1 * (1-0) = 1 (Assert fails)
	check := api.Mul(circuit.RequireAccreditation, api.Sub(1, circuit.IsAccredited))
	api.AssertIsEqual(check, 0)

	// 4. Identity Commitment Verification
	// Recompute commitment: Hash(IdentityData, Nonce) == Commitment
	// We reuse the same MiMC instance for efficiency within the circuit
	mimcHash.Reset()
	mimcHash.Write(circuit.IdentityData)
	mimcHash.Write(circuit.Nonce)
	computedCommitment := mimcHash.Sum()

	api.AssertIsEqual(circuit.Commitment, computedCommitment)

	return nil
}
