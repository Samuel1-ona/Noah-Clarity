package main

import (
	"fmt"
	"math/big"

	"github.com/consensys/gnark-crypto/ecc/bn254/fr/mimc"
)

func main() {
	// Sample data matching debug_test.go or reasonable values
	idData := big.NewInt(12345)
	nonce := big.NewInt(67890)
	addr := big.NewInt(111)

	h := mimc.NewMiMC()

	writePadded := func(val *big.Int) {
		b := make([]byte, 32)
		vb := val.Bytes()
		copy(b[32-len(vb):], vb)
		h.Write(b)
	}

	h.Reset()
	writePadded(idData)
	writePadded(nonce)
	writePadded(addr)
	commitment := h.Sum(nil)

	fmt.Printf("ID: %s\n", idData.String())
	fmt.Printf("Nonce: %s\n", nonce.String())
	fmt.Printf("Addr: %s\n", addr.String())
	fmt.Printf("Hash (1-by-1): %x\n", commitment)

	// Try all-at-once
	h.Reset()
	full := make([]byte, 96)
	copy(full[0:32], pad(idData))
	copy(full[32:64], pad(nonce))
	copy(full[64:96], pad(addr))
	h.Write(full)
	commitment2 := h.Sum(nil)
	fmt.Printf("Hash (96 bytes): %x\n", commitment2)
}

func pad(val *big.Int) []byte {
	b := make([]byte, 32)
	vb := val.Bytes()
	copy(b[32-len(vb):], vb)
	return b
}
