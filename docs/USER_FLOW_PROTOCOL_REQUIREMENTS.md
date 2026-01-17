# User Flow: Protocol-Specific KYC Requirements

## Complete User Flow

### Phase 1: Initial KYC Registration (One-Time)

```
1. User connects wallet
   ↓
2. User submits KYC documents to Attester (off-chain)
   ↓
3. Attester verifies identity and issues credential
   ↓
4. User generates ZK proof (generic proof)
   ↓
5. User gets attestation from Attester
   ↓
6. User registers KYC on-chain → register-kyc()
   ↓
✅ User now has registered KYC on-chain
```

### Phase 2: Using Protocol with Specific Requirements (Each Protocol)

```
7. User wants to access Protocol A
   ↓
8. User fetches Protocol A's requirements (off-chain)
   Example: { min_age: 21, allowed_jurisdictions: [1], require_accreditation: true }
   ↓
9. User generates proof matching Protocol A's requirements
   Uses: generateProofForProtocol(userCredential, protocolRequirements)
   ↓
10. User gets attestation from Attester (attester verifies proof)
    ↓
11. User registers/updates KYC on-chain (if needed)
    OR User already has KYC registered (reuses existing)
    ↓
12. Protocol checks: Does user have valid KYC? (on-chain check)
    Uses: isKYCValid?(userAddress)
    ↓
13. If valid: Protocol grants access ✅
    If invalid: Protocol denies access ❌
```

## Detailed Flow with Code Examples

### Step 1: Protocol Defines Requirements

**Protocol Side (Off-Chain):**
```typescript
// Protocol defines requirements (e.g., in JSON file or API)
const protocolRequirements: ProtocolRequirements = {
  min_age: 21,
  allowed_jurisdictions: [1], // US only
  require_accreditation: true
};

// Protocol exposes this via API/metadata
// Example: GET /api/requirements → returns protocolRequirements
```

### Step 2: User Fetches Protocol Requirements

**User Side:**
```typescript
// User wants to access Protocol A
const protocolRequirements = await fetchProtocolRequirements();
// Returns: { min_age: 21, allowed_jurisdictions: [1], require_accreditation: true }
```

### Step 3: User Generates Proof Matching Requirements

**User Side:**
```typescript
import { NoahSDK, ProtocolRequirements } from 'noah-clarity';

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

## Simplified Flow (Reusing Existing KYC)

If user already has KYC registered from a previous protocol:

```
User already has KYC registered on-chain
   ↓
User wants to access new Protocol B
   ↓
Protocol B checks: isKYCValid?(userAddress) → true ✅
   ↓
Protocol B grants access (trusts attester verification)
```

**Note:** User doesn't need to re-register KYC for each protocol. Once registered, the same KYC works for all protocols.

## Key Points

1. **One-Time Registration**: User registers KYC once, reuses for all protocols
2. **Protocol Requirements**: Each protocol can define specific requirements (age, jurisdictions, accreditation)
3. **Proof Generation**: User generates proof matching protocol requirements (on-demand)
4. **Attester Verification**: Attester verifies proof before signing (happens automatically)
5. **On-Chain Check**: Protocols just check if user has registered KYC (simple binary check)
6. **No Protocol Verification**: Protocols don't verify proofs themselves - they trust the attester's verification

## Visual Flow Diagram

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

## Example: User Accessing Multiple Protocols

```
User completes KYC registration once
   ↓
User wants to access Protocol A (requires 21+, US, accredited)
   → Generates proof matching Protocol A requirements
   → Gets attestation
   → Registers on-chain
   → Protocol A checks KYC → Grants access ✅
   ↓
User wants to access Protocol B (requires 18+, any jurisdiction, no accreditation)
   → Already has KYC registered
   → Protocol B checks KYC → Grants access ✅
   (User doesn't need to re-register)
   ↓
User wants to access Protocol C (requires 25+, specific jurisdictions, accredited)
   → Already has KYC registered
   → Protocol C checks KYC → Grants access ✅
```

**Important:** Once user has registered KYC on-chain, all protocols can check it. The protocol-specific proof generation is for the initial registration process. After registration, protocols just check on-chain KYC status.

