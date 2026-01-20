# Building Privacy-Preserving KYC: A Developer's Journey Through Zero-Knowledge Proofs

I remember the first time I realized how broken traditional KYC systems are. Every protocol needs to verify users, but they all want you to upload your driver's license, passport, and maybe even your firstborn child. Not only is this a privacy nightmare, but it creates unnecessary friction—users have to jump through hoops for every single protocol they want to use.

That's when I discovered Noah-v2, a privacy-preserving KYC system built for Stacks blockchain. Instead of sharing your actual data with every protocol, you generate cryptographic proofs that demonstrate you meet their requirements without revealing anything else. It's like showing your ID to prove you're over 21, except the bouncer can verify you meet the age requirement without learning your exact age, address, or any other details.

Let me walk you through how this works from a developer's perspective. We'll explore the SDK, understand the frontend example, and dive deep into the mathematical foundations that make all of this possible.

## The Developer's Entry Point: The Noah-v2 SDK

When I first started using Noah-v2, the SDK was my gateway into the system. It's published as `noah-clarity` on npm, and it abstracts away all the complexity of interacting with blockchain contracts and proof services.

### Installation and Setup

Getting started is straightforward:

```bash
npm install noah-clarity
```

Then you initialize the SDK with your configuration:

```typescript
import { NoahSDK } from 'noah-clarity';

const sdk = new NoahSDK(
  {
    kycRegistryAddress: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.kyc-registry',
    attesterRegistryAddress: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.attester-registry',
    network: 'testnet',
    proverServiceUrl: 'http://localhost:8080',
    attesterServiceUrl: 'http://localhost:8081',
  },
  {
    appName: 'Your Protocol',
  }
);
```

The SDK exposes three main interfaces:
- `sdk.contract` - For blockchain interactions (checking KYC status, registering on-chain)
- `sdk.proof` - For proof generation and attestation requests
- `sdk.wallet` - For wallet integration helpers

### The Simplest Integration Pattern

For most protocol developers, integration is remarkably simple. You just check if a user has valid KYC before allowing them to perform actions:

```typescript
const hasValidKYC = await sdk.contract.isKYCValid(userAddress);

if (!hasValidKYC) {
  // Show KYC registration UI
  showKYCRequiredMessage();
  return;
}

// User has valid KYC, proceed with the action
allowUserToDeposit();
```

That's it. The SDK handles all the blockchain calls, signature verification, and attester status checks under the hood. But if you want to understand what's happening behind the scenes, the frontend-example is your best teacher.

## Understanding the Frontend-Example: A Complete Integration Story

The `frontend-example` directory contains a fully working React application that demonstrates the entire KYC flow. Let me walk you through how it works, step by step.

### The Complete User Journey

When you open the frontend example, users see a clean interface with three main tabs:
1. **KYC Registration** - Where users complete their verification
2. **Secure Vault** - An example protocol that requires KYC
3. **Attester Management** - For organizations running attester services

The real magic happens in the KYC Registration flow. Let's trace through what happens when a user clicks "Start KYC Verification."

### Step 1: User Enters Information

In `KYCRegistration.tsx`, users fill out a simple form:
- Their age
- Their jurisdiction (from a dropdown of allowed jurisdictions)
- Whether they're an accredited investor (checkbox)

But here's the first important thing to understand: **this data never leaves the user's browser in plaintext**. The form validates that the user meets the protocol's requirements locally, but the actual credential data is only used to generate a zero-knowledge proof.

```typescript
const userCredential = {
  age: ageNum.toString(),
  jurisdiction: jurisdiction,
  is_accredited: isAccredited ? '1' : '0',
  identity_data: identityDataNumeric,  // User's wallet address converted to numeric
  nonce: nonce,  // Random nonce for uniqueness
};
```

Notice how we convert the wallet address to a numeric value? This is because the zero-knowledge proof circuits work with integers in a finite field, not strings. The `addressToNumeric` function converts the Stacks address into a big integer that the circuit can work with.

### Step 2: Generating the Privacy Proof

When the user submits the form, the frontend calls `registerKYCWithProtocol` from `lib/kyc.ts`. This function orchestrates the entire flow, but let's focus on what happens first: proof generation.

The proof generation happens in the SDK's `ProofService.generateProofForProtocol` method. Here's what it does:

1. It constructs a `ProofRequest` with:
   - **Private inputs**: The user's actual data (age, jurisdiction, accreditation status, identity data, nonce)
   - **Public inputs**: The protocol's requirements (minimum age, allowed jurisdictions, whether accreditation is required)

2. It sends this request to the prover service (running on port 8080) via HTTP POST

3. The prover service generates a Groth16 zero-knowledge proof

4. The proof, along with public inputs and a commitment hash, is returned

This is where the mathematical magic happens. The proof mathematically demonstrates that:
- The user's age is greater than or equal to the minimum age
- The user's jurisdiction is in the allowed list
- If accreditation is required, the user has it
- The identity data and nonce produce the correct commitment hash

All of this is proven without revealing the actual values. The protocol learns that the user meets the requirements, but doesn't learn the user's exact age, jurisdiction, or other details.

### Step 3: Getting Attestation

Once the proof is generated, the frontend requests an attestation from the attester service. This is where trust enters the system.

The attester service (running on port 8081) does the following:

1. **Verifies the proof**: It checks that the proof is mathematically valid using the verifying key. This ensures the proof wasn't forged or tampered with.

2. **Checks protocol requirements**: It verifies that the proof matches the protocol's requirements (from the public inputs).

3. **Signs the commitment**: If everything checks out, it signs the commitment hash with its private key using secp256k1 ECDSA.

4. **Returns the signature**: The signature, along with the attester ID and commitment, is sent back to the frontend.

The signature is crucial—it's what the blockchain contract will verify. The attester is essentially saying: "I've verified this proof, and I vouch for this commitment."

### Step 4: Registering On-Chain

With the proof verified and the commitment signed, the user can now register their KYC on the Stacks blockchain. This is where the SDK's `contract.registerKYC` method comes into play.

The registration transaction calls the `register-kyc` function in the KYC Registry contract with three parameters:
1. The commitment hash (32 bytes)
2. The signature (64 bytes: r || s)
3. The attester ID

The contract stores this registration, linking the user's address to their commitment and attester. Importantly, the commitment is a hash, so it reveals nothing about the user's actual data—only that they have valid KYC.

### Step 5: Protocols Check KYC Status

Once registered, any protocol can check if a user has valid KYC by calling:

```typescript
const hasKYC = await sdk.contract.hasKYC(userAddress);
const isValid = await sdk.contract.isKYCValid(userAddress);
```

The contract checks:
- Does this user have a registered commitment?
- Is the attester that signed it still active?
- Has the credential been revoked?
- Is the credential still within its expiration period?

If all checks pass, the protocol grants access. This is where the reusability shines—users register once, and all protocols can verify their KYC status.

## The Mathematical Foundations: Understanding the Prover

Now let's dive into the mathematical foundations. This is where things get really interesting.

### Zero-Knowledge Proofs: The Core Concept

A zero-knowledge proof is a cryptographic protocol that allows you to prove you know something (or that something is true) without revealing what that something is. In our case, we're proving that certain conditions are met without revealing the actual values.

Noah-v2 uses **Groth16 proofs**, which are a type of zk-SNARK (Zero-Knowledge Succinct Non-Interactive Argument of Knowledge). Groth16 is particularly well-suited for our use case because:
- Proofs are small (just a few hundred bytes)
- Verification is fast (milliseconds)
- The proofs are non-interactive (no back-and-forth needed)

### The Circuit: Defining What Can Be Proven

At the heart of the prover is the **circuit definition** in `circuit/kyc.go`. This defines what can be proven and what constraints must be satisfied.

The circuit has several components:

**Private Inputs (Secret Witness):**
- `Age`: The user's actual age
- `Jurisdiction`: The user's jurisdiction ID
- `IsAccredited`: Whether the user is accredited (1 or 0)
- `IdentityData`: The user's identity data (wallet address as numeric)
- `Nonce`: A random nonce for uniqueness

**Public Inputs:**
- `MinAge`: The minimum age required by the protocol
- `AllowedJurisdictions`: Array of allowed jurisdiction IDs
- `RequireAccreditation`: Whether accreditation is required (1 or 0)
- `Commitment`: The commitment hash (MiMC hash of identity data and nonce)

**Public Outputs:**
- Verification results for each check (all must be 1 for the proof to be valid)

The circuit's `Define` method establishes the constraints:

```go
// Age verification: age >= minAge
ageDiff := api.Sub(circuit.Age, circuit.MinAge)
cmpResult := api.Cmp(0, ageDiff)
ageCheck := api.Sub(1, api.IsZero(api.Sub(cmpResult, 1)))
api.AssertIsEqual(circuit.AgeVerified, ageCheck)
```

This creates a constraint that `AgeVerified` is 1 if and only if `age >= minAge`. The circuit uses arithmetic operations in a finite field, which is why everything is converted to integers.

**Jurisdiction verification** checks if the user's jurisdiction is in the allowed list:

```go
var jurisdictionCheck frontend.Variable = 0
for i := 0; i < len(circuit.AllowedJurisdictions); i++ {
    matches := api.IsZero(api.Sub(circuit.Jurisdiction, circuit.AllowedJurisdictions[i]))
    jurisdictionCheck = api.Add(jurisdictionCheck, matches)
}
api.AssertIsLessOrEqual(jurisdictionCheck, 1)
api.AssertIsEqual(circuit.JurisdictionVerified, jurisdictionCheck)
```

This iterates through all allowed jurisdictions and sets `jurisdictionCheck` to 1 if there's a match.

**Accreditation verification** ensures that if accreditation is required, the user has it:

```go
accreditationCheck := api.Sub(1, circuit.RequireAccreditation)
accreditationCheck = api.Add(accreditationCheck, api.Mul(circuit.RequireAccreditation, circuit.IsAccredited))
```

This is a clever way to express: "If accreditation is required, the user must have it; otherwise, it always passes."

**Identity commitment verification** uses the MiMC hash function:

```go
mimcHash, err := mimc.NewMiMC(api)
mimcHash.Write(circuit.IdentityData)
mimcHash.Write(circuit.Nonce)
computedCommitment := mimcHash.Sum()
api.AssertIsEqual(circuit.Commitment, computedCommitment)
```

MiMC (Merkle-Damgård based on an Iterated Miyaguchi–Preneel Compression function) is a hash function designed specifically for zero-knowledge proofs. Unlike SHA-256, MiMC operations can be efficiently represented in arithmetic circuits, making it much faster to prove.

### Proof Generation: From Constraints to Proof

When the prover service receives a proof request, here's what happens:

1. **Circuit Compilation**: The circuit is compiled into a constraint system (R1CS format). This happens once at startup and creates the proving key and verifying key.

2. **Witness Creation**: The prover creates a "witness" from the user's credential data and protocol requirements. This witness contains all the values that will be plugged into the circuit.

3. **Commitment Computation**: The prover computes the commitment hash using MiMC:

```go
func computeCommitment(identityData, nonce *big.Int) (*big.Int, error) {
    mimc := hash.MIMC_BN254.New()
    
    // Pad to 32 bytes (BN254 field size)
    identityBytes := make([]byte, 32)
    identityDataBytes := identityData.Bytes()
    copy(identityBytes[32-len(identityDataBytes):], identityDataBytes)
    mimc.Write(identityBytes)
    
    nonceBytes := make([]byte, 32)
    nonceDataBytes := nonce.Bytes()
    copy(nonceBytes[32-len(nonceDataBytes):], nonceDataBytes)
    mimc.Write(nonceBytes)
    
    hashBytes := mimc.Sum(nil)
    return new(big.Int).SetBytes(hashBytes), nil
}
```

4. **Proof Generation**: Using the proving key and witness, Groth16 generates the proof. This is a complex mathematical operation involving elliptic curve cryptography and polynomial commitments. The gnark library handles all of this complexity.

5. **Public Inputs Extraction**: The prover extracts the public inputs (protocol requirements and commitment) that need to be shared with the verifier.

The proof is serialized and returned along with the public inputs. The proof is small (typically 128-256 bytes) and can be verified in milliseconds.

### Why MiMC Instead of SHA-256?

You might wonder why we use MiMC hash instead of the more familiar SHA-256. The answer lies in circuit efficiency.

SHA-256 involves many bitwise operations (XOR, AND, shifts, etc.), which are expensive to represent in arithmetic circuits. Each bit operation requires multiple constraints, making SHA-256 proofs large and slow.

MiMC, on the other hand, uses simple arithmetic operations (addition, multiplication) over a finite field, which map directly to circuit constraints. This makes MiMC proofs much smaller and faster to generate.

The trade-off is that MiMC is newer and less battle-tested than SHA-256, but for our use case (creating commitments that are only revealed in zero-knowledge proofs), it's a reasonable choice.

## The Mathematical Foundations: Understanding the Attester

The attester service plays a crucial role: it verifies proofs and signs commitments. Let's explore how it works.

### Proof Verification: Mathematical Validation

When the attester receives an attestation request, it first verifies the proof. This happens in `proof_verifier.go`.

The verification process:

1. **Decode the Proof**: The base64-encoded proof is decoded and deserialized into a Groth16 proof object.

2. **Reconstruct Public Witness**: The public inputs are parsed and reconstructed into the circuit structure. This includes:
   - Minimum age
   - Allowed jurisdictions (all 250 of them, padded with zeros)
   - Require accreditation flag
   - Commitment hash
   - Verification result outputs

3. **Verify Using Groth16**: The gnark library's `groth16.Verify` function performs the mathematical verification:

```go
err = groth16.Verify(proof, pv.vk, pubWitness)
```

This function:
- Takes the proof (three elliptic curve points: A, B, C)
- Takes the verifying key (public parameters)
- Takes the public witness (public inputs)
- Performs pairing-based cryptography to verify that the proof is valid

The verification ensures that:
- The proof was generated using the correct proving key
- The witness satisfies all circuit constraints
- The proof is authentic (hasn't been tampered with)

If verification fails, the attester rejects the request. If it succeeds, the attester proceeds to sign the commitment.

### Signature Generation: secp256k1 ECDSA

Once the proof is verified, the attester signs the commitment hash using secp256k1 ECDSA. This is the same signature algorithm used by Bitcoin and Ethereum, which makes it compatible with Clarity's `secp256k1-verify` function.

The signing process in `signer.go`:

1. **Decode Commitment**: The commitment hash is decoded from hex (must be exactly 32 bytes).

2. **Sign with ECDSA**: The signer uses the attester's private key to sign the commitment:

```go
func (s *Signer) SignWithSHA256(messageHash []byte) (string, error) {
    // Use crypto.Sign from go-ethereum
    signature, err := crypto.Sign(messageHash, s.privateKey)
    
    // Extract r and s (first 64 bytes, discard recovery ID v)
    sigBytes := signature[:64]
    
    // Normalize to low-S (required by Clarity)
    // ... normalization logic ...
    
    return hex.EncodeToString(normalizedSig), nil
}
```

3. **Low-S Normalization**: Clarity's `secp256k1-verify` requires signatures in "low-S" form. This means the `s` component of the signature must be less than `curveOrder/2`. If it's higher, we use `curveOrder - s` instead. This prevents signature malleability.

4. **Return Signature**: The signature is returned as a 64-byte hex string (r || s, no recovery ID).

The signature serves as cryptographic proof that the attester verified the proof and vouches for the commitment. Anyone can verify this signature using the attester's public key.

### Merkle Trees: Efficient Revocation

One of the clever parts of the attester design is how it handles revocation using Merkle trees.

When a credential needs to be revoked (e.g., if identity documents are compromised), the commitment is added to a revocation list. But storing a list of all revoked commitments and checking against it would be inefficient for large lists.

Instead, the system uses a **Merkle tree** to store revoked commitments efficiently.

#### How Merkle Trees Work

A Merkle tree is a binary tree where:
- Leaves are hashes of individual commitments
- Internal nodes are hashes of their children
- The root is a single hash representing the entire tree

```
        Root
       /    \
     H12    H34
    /  \    /  \
   H1  H2  H3  H4
   |    |   |   |
  C1   C2  C3  C4
```

To prove a commitment is revoked, you need:
- The commitment hash
- A "proof path" (sibling hashes at each level)
- The root hash

The verifier reconstructs the path from the commitment to the root and checks if it matches the provided root. If it does, the commitment is revoked.

The implementation in `merkle.go`:

```go
func (mt *MerkleTree) GenerateProof(commitment string) ([]string, []bool, error) {
    // Find the commitment in the leaves
    // Generate proof path by walking up the tree
    // Return sibling hashes and their positions
}
```

The key insight is that the proof path size is logarithmic in the number of revoked commitments. For a million revoked commitments, you only need about 20 hash values in the proof path.

### Why This Architecture?

You might wonder: "Why not verify proofs on-chain?" The answer is computational cost.

Groth16 proof verification involves pairing-based cryptography, which is computationally expensive. Performing this on-chain would be:
- Extremely expensive (high gas fees)
- Slow (blockchain processing time)
- Potentially impossible (Clarity might not support all required operations)

Instead, we:
1. Generate proofs off-chain (fast, no blockchain fees)
2. Verify proofs off-chain (attester does this)
3. Store only signatures on-chain (cheap, fast verification)

The blockchain only needs to verify ECDSA signatures, which Clarity supports natively via `secp256k1-verify`. This gives us the security of on-chain verification without the computational cost.

## Bringing It All Together: The Complete Picture

Now that we understand all the pieces, let's see how they fit together in the complete flow.

### The End-to-End Flow

1. **User Completes Form**: User enters age, jurisdiction, and accreditation status in the frontend.

2. **Frontend Calls SDK**: The frontend uses `sdk.proof.generateProofForProtocol` to request a proof.

3. **SDK Sends Request to Prover**: The SDK constructs a ProofRequest and sends it to the prover service (port 8080).

4. **Prover Generates Proof**:
   - Compiles the circuit (if not already compiled)
   - Creates witness from user data and protocol requirements
   - Computes commitment using MiMC hash
   - Generates Groth16 proof using gnark
   - Returns proof, public inputs, and commitment

5. **Frontend Requests Attestation**: The frontend sends the proof to the attester service (port 8081).

6. **Attester Verifies Proof**:
   - Decodes and deserializes the proof
   - Reconstructs public witness from public inputs
   - Verifies the proof using Groth16 verification
   - If valid, signs the commitment with secp256k1 ECDSA
   - Returns signature, attester ID, and commitment

7. **Frontend Registers On-Chain**: The frontend calls `sdk.contract.registerKYC` which:
   - Prepares the transaction with commitment, signature, and attester ID
   - Signs the transaction with the user's wallet
   - Broadcasts to the Stacks network
   - Waits for confirmation

8. **Contract Stores Registration**: The KYC Registry contract stores:
   - User address → commitment mapping
   - Commitment → attester ID mapping
   - Timestamp for expiration checking

9. **Protocols Check Status**: When a user wants to use a protocol:
   - Protocol calls `sdk.contract.isKYCValid(userAddress)`
   - Contract checks: user has registration, attester is active, not revoked, not expired
   - Returns true/false
   - Protocol grants or denies access

### The Privacy Guarantee

Throughout this entire flow, the user's actual data (age, jurisdiction, etc.) is never revealed. Only:
- The commitment hash (cryptographic hash, reveals nothing)
- The signature (attester's proof of verification)
- The protocol requirements (public, already known)

The zero-knowledge proof ensures that the protocol learns "this user meets the requirements" without learning what those actual values are.

### The Trust Model

The system has a trust-minimized design:
- **Users trust attesters** to verify their identity documents (one-time, off-chain)
- **Protocols trust attesters** to verify proofs before signing (but can verify signatures on-chain)
- **Attesters are registered on-chain** so protocols can verify which attesters are legitimate
- **Multiple attesters can exist** reducing dependence on any single entity

## Conclusion: Building the Future of Privacy-Preserving Identity

Noah-v2 represents a practical application of zero-knowledge proofs to solve a real-world problem. By combining:
- Groth16 proofs for privacy
- MiMC hash for efficient commitments
- secp256k1 signatures for on-chain verification
- Merkle trees for efficient revocation

We've created a system where users can prove they meet protocol requirements without sacrificing their privacy.

The SDK makes integration simple, the frontend-example shows how it all works, and the mathematical foundations ensure security and privacy.

As a developer, you can:
- Use the SDK for simple integration (just check `isKYCValid`)
- Study the frontend-example for complete flow understanding
- Explore the circuit code to understand zero-knowledge proofs
- Deploy your own attester service if you're an organization

The future of blockchain identity doesn't have to be a trade-off between privacy and compliance. With Noah-v2, users can have both.

---

*This article was written to help developers understand and integrate Noah-v2. For more information, check out the [Architecture Guide](ARCHITECTURE.md), [API Documentation](API.md), and [Integration Guide](INTEGRATION.md).*
