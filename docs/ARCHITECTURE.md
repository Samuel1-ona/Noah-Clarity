# Noah-v2 Architecture: Understanding How Everything Works Together

When you're building a system like Noah-v2, it's helpful to understand how all the pieces fit together. This document walks you through the architecture in a way that makes sense, whether you're integrating the system or just curious about how it works.

## What Is Noah-v2, Really?

At its core, Noah-v2 is a privacy-preserving identity verification system. Think of it like this: instead of showing your driver's license to every bouncer at every club, you get a special cryptographic "badge" that proves you're over 21 without revealing your exact age or any other personal information. Each bouncer (protocol) can verify the badge is real, but they don't learn anything else about you.

## The Big Picture: How Components Work Together

Noah-v2 is built with several components that each play a specific role. Let's break them down:

### 1. Zero-Knowledge Proof Circuits (`circuit/`)

**What it is:** The mathematical "rules" that define what can be proven. Think of this as the recipe for creating proofs.

**What it does:**
- Defines how to prove someone is over a certain age (without revealing their actual age)
- Defines how to prove someone is in an allowed jurisdiction (without revealing their location)
- Defines how to prove accreditation status (without revealing financial details)
- Generates Groth16 proofs (a specific type of zero-knowledge proof that's efficient to verify)

**Tech stack:** Written in Go using the gnark library, which is excellent for creating zero-knowledge proof circuits.

### 2. Proof Service (`backend/prover/`)

**What it is:** A REST API service that takes user credentials and protocol requirements, then generates the actual zero-knowledge proofs.

**What it does:**
- Receives user credential data (age, jurisdiction, etc.) and protocol requirements
- Uses the circuits to generate a proof
- Returns the proof along with public inputs (information that will be visible, but not the sensitive user data)

**How to use it:** Send a POST request to `/proof/generate` with the user's credentials and the protocol's requirements. Get back a proof that can be verified.

**Tech stack:** Go REST API (using Gin framework), runs on port 8080 by default.

### 3. Attester Service (`backend/attester/`)

**What it is:** The "trusted authority" that verifies users are who they say they are and signs off on their proofs.

**What it does:**
- Receives identity documents from users (off-chain, privately)
- Verifies those documents are legitimate
- When users generate proofs, the attester verifies the proof is valid
- Signs the proof's commitment with its private key (creating an attestation)
- Manages credential revocation (if someone's identity is compromised)

**Think of it as:** The bouncer's boss who checks IDs and gives the official stamp of approval.

**Tech stack:** Go REST API, runs on port 8081 by default.

### 4. Smart Contracts (`kyc-registry/contracts/`)

**What it is:** On-chain Stacks smart contracts written in Clarity that store KYC registrations and manage attesters.

**What it does:**

**KYC Registry Contract:**
- Stores which users have registered KYC
- Links users to their commitment hashes and attester IDs
- Provides functions like `has-kyc?` and `is-kyc-valid?` for protocols to check

**Attester Registry Contract:**
- Manages which attesters are registered and active
- Stores attester public keys
- Allows protocols to verify an attester is legitimate before trusting their signatures

**Revocation Registry Contract:**
- Handles credential revocation if needed
- Uses Merkle trees for efficient revocation checking

**Why on-chain?** Because protocols need to verify KYC status on-chain when users interact with them. The contracts provide this verification layer.

### 5. TypeScript SDK (`packages/noah-sdk/`)

**What it is:** A developer-friendly library that handles all the complexity of interacting with Noah-v2.

**What it does:**
- Provides simple functions like `isKYCValid(userAddress)` - just call it and get a boolean
- Handles all blockchain interactions (calling contracts, parsing responses)
- Makes it easy for protocol developers to integrate KYC checks
- Published as `noah-clarity` on npm

**Why it exists:** Without the SDK, protocol developers would need to understand Clarity contracts, handle transaction signing, parse responses, etc. The SDK makes it as simple as: "Does this user have KYC? Yes or no?"

### 6. Frontend Example (`frontend-example/`)

**What it is:** A complete example application showing how to build a user-facing interface for Noah-v2.

**What it does:**
- Demonstrates the full KYC registration flow from a user's perspective
- Shows how protocols can integrate KYC checks
- Provides working code that developers can reference
- Includes example protocols (like a simple vault)

**Tech stack:** React with TypeScript, Material-UI for components.

## How Data Flows Through the System

Let's trace what happens when a user wants to use a protocol that requires KYC:

```
Step 1: User Identity Verification (Off-Chain)
───────────────────────────────────────────────
User → Attester Service
  • User submits identity documents
  • Attester verifies they're legitimate
  • Attester stores credential data (user keeps this private)
  
Step 2: User Wants to Use a Protocol
─────────────────────────────────────
User → Protocol Frontend
  • "I want to deposit funds"
  • Protocol: "First, let's check your KYC status"
  
Step 3: Generate Privacy Proof
──────────────────────────────
User → Proof Service
  • User's credential data + Protocol's requirements
  • Proof Service generates ZK proof
  • Returns proof + public inputs
  
Step 4: Get Attestation
───────────────────────
User → Attester Service
  • User sends proof for verification
  • Attester verifies proof is valid
  • Attester signs commitment with private key
  • Returns signature + commitment
  
Step 5: Register On-Chain
─────────────────────────
User → Stacks Blockchain
  • User submits transaction: register-kyc(commitment, signature, attester-id)
  • KYC Registry contract stores: user address + commitment + attester ID
  • Transaction confirmed on blockchain
  
Step 6: Protocol Checks KYC
────────────────────────────
Protocol → KYC Registry Contract (On-Chain)
  • Protocol calls: isKYCValid?(user-address)
  • Contract checks: user has valid KYC registered
  • Returns: true ✅
  
Step 7: Grant Access
────────────────────
Protocol → User
  • "Your KYC is valid, you can proceed"
  • User can now deposit/withdraw/etc.
```

## Security Considerations

When building privacy-preserving systems, security is critical. Here's how Noah-v2 handles it:

### Proofs Are Generated Off-Chain

Why? Because Clarity smart contracts can't efficiently verify Groth16 zero-knowledge proofs. The proofs are complex mathematical computations that are better suited for off-chain generation. The blockchain verifies something simpler: attester signatures.

### On-Chain Verification Uses Signatures

Instead of verifying proofs on-chain, the system uses cryptographic signatures from attesters. This is:
- **Efficient:** Signature verification is fast and cheap on the blockchain
- **Secure:** Attesters sign commitments with their private keys, and anyone can verify the signature using the public key
- **Practical:** Protocols just need to check "does this user have a valid attestation signature?"

### Multi-Attester Model

The system supports multiple attesters, not just one. This means:
- **Reduced trust:** You don't have to trust a single attester
- **Competition:** Multiple attesters can compete, improving service quality
- **Resilience:** If one attester goes down, others can still operate

### Revocation Support

If someone's identity documents are compromised, their credentials can be revoked. The system uses Merkle trees for efficient revocation checking, so protocols can verify credentials haven't been revoked without storing huge revocation lists.

### Credential Expiration

Credentials can have expiration timestamps. This allows for periodic re-verification if needed, ensuring that identity verification remains current.

## Why This Architecture?

You might wonder: "Why not just store everything on-chain?" or "Why not verify proofs on-chain?"

**Storing requirements off-chain:** Protocol requirements change frequently. Storing them on-chain would require transactions every time you want to update requirements. Storing them off-chain (in JSON files, IPFS, etc.) is more flexible and cost-effective.

**Generating proofs off-chain:** Zero-knowledge proofs are computationally expensive. Generating them off-chain means users don't pay blockchain transaction fees for proof generation, and the process is much faster.

**Verifying signatures on-chain:** Signatures are quick to verify on the blockchain. This gives us the security of on-chain verification without the computational cost of verifying proofs.

This architecture balances privacy, security, efficiency, and cost-effectiveness.
