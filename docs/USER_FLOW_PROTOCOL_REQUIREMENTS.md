# User Flow: Understanding the Complete KYC Journey

This document walks through the complete user journey in Noah-v2, from initial KYC registration to using multiple protocols. Understanding this flow helps you build better user experiences and integrate KYC into your protocol effectively.

## The Two-Phase Journey

The Noah-v2 user journey has two distinct phases:

1. **Phase 1: Initial KYC Registration** - Users do this once, when they first start using protocols that require KYC
2. **Phase 2: Using Protocols** - Users do this each time they want to use a protocol, but it gets simpler after the first time

Let's walk through each phase in detail.

## Phase 1: Initial KYC Registration (One-Time Process)

This is what happens when a user first encounters a protocol that requires KYC. They need to complete the full registration process.

### Step-by-Step Flow

```
1. User connects their wallet
   ↓
2. User sees "KYC Required" message
   ↓
3. User clicks "Start KYC Registration"
   ↓
4. User submits identity documents to Attester (off-chain)
   • User uploads documents (driver's license, passport, etc.)
   • Documents are sent to the Attester Service
   • This happens privately, off-chain
   ↓
5. Attester verifies identity and issues credential
   • Attester checks documents are legitimate
   • Attester stores credential data (user keeps this private)
   • User now has verified credentials
   ↓
6. User generates zero-knowledge proof
   • User's credential data → Proof Service
   • Proof Service generates cryptographic proof
   • Proof proves user has valid credentials without revealing data
   ↓
7. User gets attestation from Attester
   • User sends proof to Attester Service
   • Attester verifies the proof is valid
   • Attester signs commitment with private key
   • Returns signature + commitment to user
   ↓
8. User registers KYC on-chain
   • User submits transaction: register-kyc(commitment, signature, attester-id)
   • KYC Registry contract stores: {user-address, commitment, attester-id}
   • Transaction confirmed on blockchain
   ↓
✅ User now has KYC registered on-chain
   (This registration works for ALL protocols!)
```

### What Users Experience

From a user's perspective, this feels like:
1. "I need to verify my identity to use this protocol"
2. "I'll upload my documents"
3. "I'll wait for verification" (this might take a few minutes or hours, depending on the attester)
4. "Great! I'm verified and registered"

The complexity (proof generation, attestation, on-chain registration) is handled by the SDK and backend services, so users just see a simple flow.

## Phase 2: Using Protocols (What Happens Each Time)

Once a user has registered KYC, they can use any protocol that requires KYC. Here's what happens:

### Step-by-Step Flow

```
User wants to access Protocol A
   ↓
Protocol A publishes requirements (off-chain)
   Example: { min_age: 21, allowed_jurisdictions: [1], require_accreditation: true }
   ↓
User fetches Protocol A's requirements
   • Protocol serves requirements from config file, JSON, IPFS, CDN, or API
   • User's application receives requirements
   ↓
User generates proof matching Protocol A's requirements
   • User's credential data + Protocol A's requirements → Proof Service
   • Proof Service generates ZK proof
   • Proof proves: user meets Protocol A's requirements
   ↓
User gets attestation from Attester
   • User sends proof to Attester Service
   • Attester verifies proof matches requirements
   • Attester signs commitment
    ↓
User registers/updates KYC on-chain (if needed)
   OR User already has KYC registered (can reuse existing)
    ↓
Protocol A checks user's KYC status (on-chain)
   • Protocol calls: isKYCValid?(user-address)
   • KYC Registry checks: user has valid KYC registered
   • Returns: true ✅
   ↓
Protocol A grants access to user
   • User can now deposit, trade, vote, etc.
```

### The Beautiful Part: Reusability

Here's where it gets interesting. Once a user has registered KYC on-chain, **they can use it with any protocol**:

```
User has KYC registered on-chain (from Phase 1)
   ↓
User wants to use Protocol B
   • Protocol B checks: isKYCValid?(user-address)
   • Returns: true ✅
   • Protocol B grants access
   (No re-registration needed!)
   ↓
User wants to use Protocol C
   • Protocol C checks: isKYCValid?(user-address)
   • Returns: true ✅
   • Protocol C grants access
   (Still no re-registration needed!)
```

**Key insight:** Users register KYC once, then reuse it everywhere. Protocols just check if the user has valid KYC registered - they don't need to know the user's specific credentials.

## Detailed Flow with Code Examples

Let's look at what the code looks like for each step.

### Step 1: Protocol Defines Requirements

**Protocol Side (Off-Chain):**

The protocol defines what it needs. This could be in a config file, JSON file, or API:

```typescript
// Protocol defines requirements
const protocolRequirements: ProtocolRequirements = {
  min_age: 21,
  allowed_jurisdictions: [1], // US only
  require_accreditation: true
};

// Protocol exposes this (maybe via API, config file, etc.)
// Users fetch this before generating proofs
```

### Step 2: User Fetches Protocol Requirements

**User Side:**

When a user wants to use a protocol, they fetch the requirements:

```typescript
// User wants to access Protocol A
const protocolRequirements = await fetchProtocolRequirements('protocol-a');
// Returns: { min_age: 21, allowed_jurisdictions: [1], require_accreditation: true }
```

### Step 3: User Generates Proof Matching Requirements

**User Side:**

The user generates a proof that matches the protocol's requirements. The SDK handles this:

```typescript
import { NoahSDK } from 'noah-clarity';

const sdk = new NoahSDK(config, walletConfig);

// User's credential data (private - known only to user)
const userCredential = {
  age: "25",                    // User is 25 years old
  jurisdiction: "1",            // US jurisdiction
  is_accredited: "1",           // User is accredited
  identity_data: userAddress,   // User's identity
  nonce: generateNonce()        // Random nonce
};

// Protocol's requirements (public)
const protocolRequirements: ProtocolRequirements = {
  min_age: 21,
  allowed_jurisdictions: [1],
  require_accreditation: true
};

// Generate proof matching protocol requirements
const proofResponse = await sdk.proof.generateProofForProtocol(
  userCredential,
  protocolRequirements
);

// proofResponse contains:
// - proof: serialized ZK proof
// - public_inputs: public inputs including protocol requirements
// - commitment: commitment hash
```

### Step 4: User Gets Attestation from Attester

**User Side:**

After generating a proof, the user needs an attestation signature:

```typescript
// Request attestation (attester verifies proof internally)
const attestationResponse = await sdk.proof.requestAttestation({
  commitment: proofResponse.commitment,
  public_inputs: proofResponse.public_inputs,
  proof: proofResponse.proof,
  user_id: userAddress
});

// Attester returns:
// - signature: attester's signature
// - attester_id: ID of the attester
// - commitment: commitment hash
```

### Step 5: User Registers/Updates KYC On-Chain

**User Side:**

Finally, the user registers their KYC on-chain:

```typescript
// Register KYC on-chain (or update if already registered)
const txId = await sdk.contract.registerKYC({
  commitment: attestationResponse.commitment,
  signature: attestationResponse.signature,
  attesterId: attestationResponse.attester_id
}, userPrivateKey);

// Wait for transaction confirmation
await waitForTransaction(txId);
```

### Step 6: Protocol Checks KYC and Grants Access

**Protocol Side:**

Now the protocol can check if the user has valid KYC:

```typescript
// Protocol checks if user has valid KYC
const hasValidKYC = await sdk.contract.isKYCValid(userAddress);

if (hasValidKYC) {
  // User has registered KYC (attester already verified proof)
  // Protocol grants access
  allowUserAccess();
} else {
  // User needs to complete KYC
  showKYCRequiredMessage();
}
```

## Simplified Flow: Reusing Existing KYC

If a user already has KYC registered from a previous protocol, using a new protocol is much simpler:

```
User already has KYC registered on-chain (from previous protocol)
   ↓
User wants to access new Protocol B
   ↓
Protocol B checks: isKYCValid?(userAddress) → true ✅
   ↓
Protocol B grants access (trusts attester verification)
```

**Note:** The user doesn't need to re-register KYC for each protocol. Once registered, the same KYC works for all protocols. This is one of the key benefits of Noah-v2 - users verify once, use everywhere.

## Key Points to Understand

1. **One-Time Registration**: Users register KYC once, then reuse it for all protocols. This is a huge UX improvement over traditional KYC systems.

2. **Protocol Requirements**: Each protocol can define specific requirements (age, jurisdictions, accreditation), but users don't need to register separately for each one. They generate proofs matching each protocol's requirements, but the on-chain registration is shared.

3. **Proof Generation**: Users generate proofs matching protocol requirements on-demand. This happens automatically when users want to use a protocol.

4. **Attester Verification**: Attesters verify proofs before signing. This happens automatically - users don't need to understand the verification process.

5. **On-Chain Check**: Protocols just check if users have registered KYC (simple binary check). They don't verify proofs themselves - they trust the attester's verification.

6. **Privacy Preserved**: Throughout this entire flow, users' actual data (age, location, etc.) is never revealed to protocols. Protocols only learn that users meet their requirements.

## Visual Flow Diagram

Here's a visual representation of the flow:

```
┌─────────────┐
│   Protocol  │ Defines requirements (off-chain)
│      A      │ { min_age: 21, jurisdictions: [1], accredited: true }
└──────┬──────┘
       │
       │ User fetches requirements
       ↓
┌─────────────┐
│    User     │ Generates proof matching requirements
│             │ generateProofForProtocol(credential, requirements)
└──────┬──────┘
       │
       │ Gets attestation (attester verifies)
       ↓
┌─────────────┐
│  Attester   │ Verifies proof → Signs commitment
│  Service    │ Returns signature
└──────┬──────┘
       │
       │ User registers on-chain
       ↓
┌─────────────┐
│KYC Registry │ Stores: {user, commitment, attester-id}
│  (On-chain) │
└──────┬──────┘
       │
       │ Protocol checks KYC
       ↓
┌─────────────┐
│   Protocol  │ isKYCValid?(user) → true ✅
│      A      │ Grants access
└─────────────┘
```

## Real-World Example: User Accessing Multiple Protocols

Let's see what this looks like for a real user:

```
Alice completes KYC registration once (Phase 1)
   ↓
Alice wants to access Protocol A (requires 21+, US, accredited)
   → Generates proof matching Protocol A requirements
   → Gets attestation
   → Registers on-chain
   → Protocol A checks KYC → Grants access ✅
   ↓
Alice wants to access Protocol B (requires 18+, any jurisdiction, no accreditation)
   → Already has KYC registered
   → Protocol B checks KYC → Grants access ✅
   (Alice doesn't need to re-register)
   ↓
Alice wants to access Protocol C (requires 25+, EU/UK only, accredited)
   → Already has KYC registered
   → Protocol C checks KYC → Grants access ✅
```

**Important insight:** Once Alice has registered KYC on-chain, all protocols can check it. The protocol-specific proof generation happens during the initial registration process. After registration, protocols just check on-chain KYC status - a simple, fast operation.

## What This Means for Protocol Developers

As a protocol developer, your job is simple:

1. **Define your requirements** (optional, but recommended)
2. **Check KYC before allowing actions**: `isKYCValid?(userAddress)`
3. **Grant or deny access** based on the result

You don't need to:
- Verify proofs yourself (the attester does this)
- Store user credential data (users keep this private)
- Manage KYC registration flows (the SDK handles this)
- Understand zero-knowledge proofs (the SDK abstracts this away)

Just check if users have valid KYC, and proceed accordingly. It's that simple!
