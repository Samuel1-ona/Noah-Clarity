# Noah SDK: Privacy-Preserving KYC for Developers

Welcome to the **Noah SDK**. This library is the primary tool for developers to integrate privacy-preserving KYC into Stacks applications. 

Rather than wrestling with Zero-Knowledge circuits or complex cryptography, you can use this SDK to guide your users through a secure identity verification process that respects their privacy.

---

##  Understanding the Lifecycle

Integrating Noah isn't just about calling an API; it’s about managing a "User Journey" that spans the real world, our off-chain services, and the blockchain.

### The Two-Phase Flow
1.  **Identity Issuance**: The user "checks in" with a trusted Attester. Their document is verified (via OCR), and they receive a **Signed ZK-Credential**. This stage happens entirely between the user and the Attester.
2.  **KYC Registration**: The user takes that credential and generates a **Zero-Knowledge Proof** (using the Prover). This proof is then bundled with an **On-chain Attestation** and registered in the `kyc-registry` contract.

---

##  Getting Started

### Installation
```bash
npm install noah-clarity
```

### Initialization
The `NoahSDK` class is your main entry point. It coordinates several specialized services under the hood.

```typescript
import { NoahSDK } from 'noah-clarity';

const sdk = new NoahSDK({
  kycRegistryAddress: 'ST123...kyc-registry',
  attesterRegistryAddress: 'ST456...attester-registry',
  proverServiceUrl: 'http://localhost:8080',
  attesterServiceUrl: 'http://localhost:8081',
  network: 'testnet',
}, {
  appName: 'My Privacy App',
  appIcon: 'https://myapp.com/icon.png',
});
```

---

##  Main Developer APIs

### 1. The Automated KYC Flow
The simplest way to integrate is using `registerKYC`. This method handles the state machine of proving, attesting, and broadcasting to the blockchain for you.

```typescript
const txId = await sdk.registerKYC(
  {
    ...issuedCredential, // Data received from the Attester in Phase 1
    min_age: "18",
    allowed_jurisdictions: ["US", "DE", "FR"],
    require_accreditation: "0",
  },
  userPrivateKey
);
```

### 2. Handling Long-Running Jobs
ZK Proof generation can take ~10-15 seconds. If the user refreshes the page, the SDK remembers where it left off. Use `resumeKYC` on page load to check for interrupted work.

```typescript
const resumedTxId = await sdk.resumeKYC(userPrivateKey);
if (resumedTxId) {
  console.log("Success! Interrupted KYC has been completed.");
}
```

### 3. Real-time UI Updates
Don't leave your users staring at a spinner. Use our event system to build a rich progress UI.

```typescript
sdk.on('state-changed', (state) => {
  // state.currentStage: 'proving' | 'attesting' | 'registering' | 'completed' | 'failed'
  updateMyProgressBar(state.currentStage);
});

sdk.on('tx-broadcasted', ({ txId }) => {
  showToast(`Transaction submitted: ${txId}`);
});
```

---

##  API Reference

The `NoahSDK` class is the main entry point, exposing specialized services for identity, proofing, and contract interactions.

### Main SDK (`sdk.*`)
| Method | Description |
| :--- | :--- |
| `registerKYC(req, pk, opts?)` | The standard automated flow: Prove -> Attest -> Register. |
| `resumeKYC(pk, opts?)` | Continues an interrupted process from local storage. |
| `getState()` | Returns the current stage (`proving`, `registering`, etc.). |
| `resetState()` | Resets the internal state machine to `idle`. |
| `on(event, cb)` | Subscribes to lifecycle events. |
| `computeCommitment(data, n, addr)` | Recomputes a MiMC commitment locally for privacy. |

### Identity Service (`sdk.identity.*`)
| Method | Description |
| :--- | :--- |
| `verifyPassport(file \| blob)` | Uploads image to Attester for OCR extraction. |
| `issueCredential(req)` | Requests a signed ZK-credential from the Attester. |
| `getAttesterInfo()` | Fetches active Attester ID and public key. |

### Proof Service (`sdk.proof.*`)
| Method | Description |
| :--- | :--- |
| `generateProof(req)` | Submits a proof generation job to the Prover. |
| `waitForProof(jobId, int?, timeout?)` | Polls the Prover service until the ZK proof is ready. |
| `requestAttestation(req)` | Sends a completed ZK proof to the Attester for a signature. |
| `getPersistedJobId()` | Retrieves active job ID from local storage. |
| `clearPersistedJob()` | Clears saved job data. |
| `generateProofForProtocol(cred, reqs)` | Helper to build a proof matching specific protocol requirements. |
| `verifyPublicInputs(res, expected)` | Validates that a generated proof matches your requirements locally. |

### Contract Service (`sdk.contract.*`)
| Method | Description |
| :--- | :--- |
| `hasKYC(principal)` | Queries the blockchain if an address is registered. |
| `getKYC(principal)` | Returns on-chain registration details (commitment, date). |
| `isKYCValid(principal)` | Checks if KYC is present AND not revoked. |
| `revokeKYC(principal, pk)` | Revokes a registration (requires admin/attester rights). |
| `getContractOwner(registry)` | Returns owner of a specific registry contract. |
| `transferOwnership(reg, owner, pk)` | Transfers contract management rights. |
| `addAttester(params, pk)` | Registry management: add a new trusted attester. |
| `deactivateAttester(id, pk)` | Registry management: deactivate a compromised attester. |
| `getAttester(id)` | Fetches details and status for a specific attester ID. |
| `getAllAttesters()` | Returns a list of all registered attester IDs. |
| `updateRevocationRoot(root, pk)` | Admin: update the Merkle root of revoked identities. |
| `getRevocationRoot()` | Fetches the current revocation root from the contract. |
| `getRevocationRootHeight()` | Returns the block height of the last revocation update. |
| `isCommitmentRevoked(comm)` | Checks our off-chain cache if a commitment is revoked. |
| `waitForConfirmation(txId)` | Polls Stacks API until a transaction is included in a block. |

### Blinding Manager (`sdk.blinding.*`)
| Method | Description |
| :--- | :--- |
| `getOrCreateNonce(addr)` | Manages persistent user nonces for privacy. |
| `setNonce(addr, nonce)` | Explicitly set a nonce (e.g., during recovery). |
| `clearNonce(addr)` | Remove a nonce (use with caution). |

### Wallet Helper (`sdk.wallet.*`)
| Method | Description |
| :--- | :--- |
| `getUserAddress(session)` | Helper to extract address from Stacks Connect sessions. |
| `isAuthenticated(session)` | Checks if the user is signed into a wallet. |
| `getAppName()` | Returns the configured app name. |

---

##  Security & Privacy
- **Client-Side Commitment**: Whenever possible, MiMC commitments are computed in the user's browser, meaning raw identity data stays local.
- **Fail-Soft Discovery**: The SDK coordinates with the Attester to find active identities even under high API load.
- **Persistent Blinding**: Nonces are stored locally using a secure `StorageInterface` to prevent identity leaks across sessions.

---

##  Event API Reference

| Event | Metadata | Triggered When... |
| :--- | :--- | :--- |
| `proof-started` | `{ userAddress, jobId }` | Proving request is sent to the worker. |
| `proof-completed` | `ProofResult` | ZK proof data is ready. |
| `attestation-received` | `AttestationResponse` | Attester has signed the proof for on-chain use. |
| `tx-broadcasted` | `{ txId }` | Registration transaction sent to Stacks. |
| `tx-confirmed` | `{ txId }` | Transaction confirmed in a Stacks block. |
| `state-changed` | `KYCLifecycleState` | The high-level stage changes. |
| `error` | `Error` | Any stage fails with an exception. |
