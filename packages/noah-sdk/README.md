# Noah SDK: Privacy-Preserving KYC for Developers

The Noah SDK provides a high-level TypeScript interface for integrating privacy-preserving KYC into your Stacks applications. It handles the complexity of Zero-Knowledge Proof (ZKP) generation, attestation signatures, and on-chain registration while keeping user data private.

---

## 🚀 Getting Started

### Installation

```bash
npm install noah-clarity
```

### Initialization

To start using the SDK, you need to configure the service URLs and the target smart contracts.

```typescript
import { NoahSDK } from 'noah-clarity';

const sdk = new NoahSDK(
  {
    kycRegistryAddress: 'ST123...kyc-registry',
    attesterRegistryAddress: 'ST123...attester-registry',
    proverServiceUrl: 'https://prover.noah.xyz',
    attesterServiceUrl: 'https://attester.noah.xyz',
    network: 'testnet', // 'mainnet' | 'testnet' | 'devnet'
  },
  {
    appName: 'My Awesome DeFi App',
    appIcon: 'https://myapp.com/logo.png',
  }
);
```

---

## 🛠️ How it Works: The Two-Step Flow

Integrating Noah-Clarity involves two distinct phases: **Identity Issuance** and **KYC Registration**.

### Step 1: Identity Issuance (Document Upload)
First, the user's document is verified by the Attester. This step extracts the identity data via OCR and issues a signed ZK-credential.

```typescript
// 1. Upload passport image for OCR extraction
const { data: docInfo } = await sdk.identity.verifyPassport(passportFile);

// 2. Request a signed ZK-credential
const response = await sdk.identity.issueCredential({
  user_id: "user-unique-id",
  user_address: "ST123...",
  attributes: { ...docInfo },
  documents: [docInfo],
});
```

### Step 2: KYC Registration (Proving & On-Chain)
Now, use the issued credential to generate a Zero-Knowledge Proof that reveals only what the protocol needs (e.g., "Age > 21") and registers it on-chain.

```typescript
// The registerKYC method handles ZK-proving and blockchain broadcasting
const txId = await sdk.registerKYC(
  {
    ...response.credential, // Use fields from the issued credential
    min_age: "21",
    allowed_jurisdictions: ["US", "UK"],
    require_accreditation: "0",
  },
  userPrivateKey
);
```

---

### 2. Built-in Persistence & Resumption
ZK proof generation can take time. If the user refreshes the page or closes the browser, the SDK automatically persists the current `jobId` to `localStorage`.

You can resume a pending process simply by calling:
```typescript
const resumedTxId = await sdk.resumeKYC(userPrivateKey);
if (resumedTxId) {
  console.log("Resumed and completed KYC registration!");
}
```

### 3. Real-time Events
The SDK emits events at every stage of the lifecycle. This is perfect for updating your UI progress bars or status indicators.

```typescript
sdk.on('state-changed', (state) => {
  console.log(`Current Stage: ${state.currentStage}`);
});

sdk.on('proof-completed', (result) => {
  console.log('ZK Proof generated successfully!');
});

sdk.on('error', (err) => {
  console.error('Oops!', err.message);
});
```

### 4. Privacy-First Blinding
User nonces (blinding factors) are managed automatically by the `BlindingManager`. This ensures that even if a user performs KYC multiple times, their identity remains un-linkable on-chain.

---

## 🎓 Advanced Usage

### Manual Service Access
If you need more control, you can access the underlying services directly:

- `sdk.contract`: Low-level Stacks contract interactions.
- `sdk.proof`: Direct ZK-Prover and Attester API calls.
- `sdk.blinding`: Manage user-specific nonces and commitments.

### Custom Storage
By default, the SDK uses `BrowserStorage` (indexed to `localStorage`). You can provide your own implementation of `StorageInterface` for Node.js or mobile environments.

```typescript
const sdk = new NoahSDK({
  // ...
  storage: myCustomStorageImplementation,
});
```

---

## � API Reference

The `NoahSDK` class is the main entry point, exposing specialized services for identity, proofing, and contract interactions.

### Main SDK (`sdk.*`)
| Method | Description |
| :--- | :--- |
| `registerKYC(req, pk)` | The standard automated flow: Prove -> Attest -> Register. |
| `resumeKYC(pk)` | Continues an interrupted process from local storage. |
| `getState()` | Returns the current stage (`proving`, `registering`, etc.). |
| `resetState()` | Resets the internal state machine to `idle`. |
| `on(event, cb)` | Subscribes to lifecycle events. |
| `computeCommitment(data, n, addr)` | Recomputes a MiMC commitment locally. |

### Identity Service (`sdk.identity.*`)
| Method | Description |
| :--- | :--- |
| `verifyPassport(file)` | Uploads image to Attester for OCR extraction. |
| `issueCredential(req)` | Requests a signed ZK-credential from the Attester. |
| `getAttesterInfo()` | Fetches active Attester ID and public key. |

### Proof Service (`sdk.proof.*`)
| Method | Description |
| :--- | :--- |
| `generateProof(req)` | Submits a proof generation job to the Prover. |
| `waitForProof(jobId)` | Polls the Prover service until the ZK proof is ready. |
| `requestAttestation(req)` | Sends a completed ZK proof to the Attester for a signature. |

### Contract Service (`sdk.contract.*`)
| Method | Description |
| :--- | :--- |
| `hasKYC(principal)` | Queries the blockchain if an address is registered. |
| `getKYC(principal)` | Returns on-chain registration details (commitment, date). |
| `isKYCValid(principal)` | Checks if KYC is present AND not revoked. |
| `revokeKYC(principal, pk)` | Revokes a registration (requires admin/attester rights). |

### Blinding & Wallet (`sdk.blinding.*` / `sdk.wallet.*`)
| Method | Description |
| :--- | :--- |
| `getOrCreateNonce(addr)` | Manages persistent user nonces for privacy. |
| `getUserAddress(session)` | Helper to extract address from Stacks Connect sessions. |
| `isAuthenticated(session)` | Checks if the user is signed into a wallet. |

---

## 🛡️ Security
The Noah SDK performs MiMC commitment computation locally whenever possible to ensure that raw identity data is only shared with the trusted Attester and never touches the Prover or the blockchain.
