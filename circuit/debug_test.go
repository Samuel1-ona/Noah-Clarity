package circuit

import (
	"bytes"
	"fmt"
	"math/big"
	"testing"

	"github.com/consensys/gnark-crypto/ecc"
	"github.com/consensys/gnark-crypto/ecc/bn254/fr"
	"github.com/consensys/gnark-crypto/ecc/bn254/fr/mimc"
	bn254eddsa "github.com/consensys/gnark-crypto/ecc/bn254/twistededwards/eddsa"
	"github.com/consensys/gnark/backend/groth16"
	"github.com/consensys/gnark/frontend"
	"github.com/consensys/gnark/frontend/cs/r1cs"
	stdeddsa "github.com/consensys/gnark/std/signature/eddsa"
)

func TestDebugKYC(t *testing.T) {
	// Sample data
	idData := big.NewInt(12345)
	nonce := big.NewInt(67890)
	addr := big.NewInt(111) // Simple address

	// 1. Compute commitment
	h := mimc.NewMiMC()

	writePadded := func(val *big.Int) {
		b := make([]byte, 32)
		vb := val.Bytes()
		copy(b[32-len(vb):], vb)
		h.Write(b)
	}

	writePadded(idData)
	writePadded(nonce)
	writePadded(addr)
	commitmentBytes := h.Sum(nil)
	var commitment fr.Element
	commitment.SetBytes(commitmentBytes)

	// 2. Sign the commitment
	seed := [32]byte{1, 2, 3} // Dummy seed
	privKey, _ := bn254eddsa.GenerateKey(bytes.NewReader(seed[:]))
	pubKey := privKey.PublicKey

	signatureBytes, _ := privKey.Sign(commitmentBytes, mimc.NewMiMC())

	// Parse signature
	var sig bn254eddsa.Signature
	sig.SetBytes(signatureBytes)

	// 3. Define the witness assignment
	merkleDepth := 20
	assignment := &KYCCircuit{
		Age:          25,
		Jurisdiction: 1,
		IsAccredited: 1,
		IdentityData: idData,
		Nonce:        nonce,
		MerklePath:   make([]frontend.Variable, merkleDepth),
		MerkleHelper: make([]frontend.Variable, merkleDepth),
		Signature: stdeddsa.Signature{
			R: struct {
				X, Y frontend.Variable
			}{X: sig.R.X, Y: sig.R.Y},
			S: sig.S,
		},
		MinAge:               18,
		JurisdictionRoot:     0,
		RequireAccreditation: 1,
		UserAddress:          addr,
		Commitment:           commitment,
	}
	for i := 0; i < merkleDepth; i++ {
		assignment.MerklePath[i] = 0
		assignment.MerkleHelper[i] = 0
	}

	// Set AttesterPublicKey
	assignment.AttesterPublicKey.A.X = pubKey.A.X
	assignment.AttesterPublicKey.A.Y = pubKey.A.Y

	// 4. Compile
	circuit := &KYCCircuit{
		MerklePath:   make([]frontend.Variable, merkleDepth),
		MerkleHelper: make([]frontend.Variable, merkleDepth),
	}
	ccs, err := frontend.Compile(ecc.BN254.ScalarField(), r1cs.NewBuilder, circuit)
	if err != nil {
		t.Fatal(err)
	}

	// 5. Test witness
	witness, err := frontend.NewWitness(assignment, ecc.BN254.ScalarField())
	if err != nil {
		t.Fatal(err)
	}

	// 6. Check satisfaction
	// 6. Check satisfaction (using Verify as check)
	pk, vk, err := groth16.Setup(ccs)
	if err != nil {
		t.Fatal(err)
	}
	proof, err := groth16.Prove(ccs, pk, witness)
	if err != nil {
		t.Fatalf("Prove failed: %v", err)
	}
	pubWitness, err := witness.Public()
	if err != nil {
		t.Fatal(err)
	}
	err = groth16.Verify(proof, vk, pubWitness)
	if err != nil {
		t.Fatalf("Verify failed: %v", err)
	}
	fmt.Println("Constraint SATISFIED")
}
