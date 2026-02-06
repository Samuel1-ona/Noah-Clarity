# Noah-v2 Frontend Example: Building with Privacy

Welcome to the **Noah-v2 Reference Application**. This example project is designed to show you exactly how to build a privacy-first user experience using the Noah SDK.

Rather than just "connecting a wallet," this app guides users through a modern, secure, and privacy-preserving KYC journey.

---

##  The Philosophy of the UX

Privacy is only powerful if people use it. Our frontend example focuses on three core pillars:
1.  **Transparency**: Explaining *why* we need a document and *what* the ZK-proof covers.
2.  **Modernity**: Using Material UI (MUI) to create a premium, high-trust interface.
3.  **Low Friction**: Using OCR to auto-fill forms and resume long-running ZK jobs.

## SDK Methods in Action

The example application demonstrates the practical usage of the Noah SDK. Below are the key methods called in `src/lib/kyc.ts` and why they are important for the developer:

| service.method | Lifecycle Stage | Why it's used here |
| :--- | :--- | :--- |
| `sdk.contract.getKYC` | **Discovery** | Checks if a user already has a commitment registered on-chain. Used to populate the initial UI state. |
| `sdk.contract.isKYCValid` | **Verification** | A high-level helper that checks if a user is registered *and* not revoked. Essential for gatekeeping protected features. |
| `sdk.proof.generateProofForProtocol` | **Privacy** | The core of the ZK flow. It submits the user's details to the Prover to create a proof that matches a protocol's specific needs (e.g., "Age > 18"). |
| `sdk.proof.waitForProof` | **Wait Stage** | Since ZK generation is intensive and asynchronous, this method polls the Prover until the binary proof file is ready. |
| `sdk.proof.requestAttestation` | **Trust Exchange** | Sends the completed ZK proof back to the Attester to receive a finalized on-chain signature. This "double-checks" the proof before it hits the blockchain. |

---

## Key Implementation Patterns

### 1. Initializing the Engine
All SDK interactions are centered in `src/lib/kyc.ts`. We initialize the `NoahSDK` with environment-specific URLs and contract addresses.

```typescript
export const sdk = new NoahSDK(SDK_CONFIG, WALLET_CONFIG);
```

### 2. The OCR Advantage (`DocumentUpload.tsx`)
We don't ask users to manually type their passport numbers.
- **Workflow**: User uploads an image -> Attester service runs OCR -> UI auto-fills the KYC form.
- **Benefit**: This reduces user error and ensures the data used for the ZK-proof matches the physical document exactly.

### 3. Privacy-First "Waiters" (`KYCRegistration.tsx`)
ZK-proof generation is computationally expensive. This component demonstrates how to use the SDK's event system to keep the user informed:
- **`proving`**: The Prover is crunching numbers (10-15s).
- **`attesting`**: The Attester is verifying the proof and signing the on-chain "voucher."
- **`registering`**: The wallet extension (Stacks Connect) pops up for the final on-chain registration.

### 4. Hybrid Transaction Signing
A unique feature of this example is how it handles signing:
- **EdDSA (Invisible)**: The SDK handles internal ZK signatures automatically.
- **ECDSA (Visible)**: We use `@stacks/connect` in `lib/kyc.ts` to trigger the user's wallet (Leather/Xverse) for the final transaction, ensuring the user is always in control of their funds and on-chain identity.

---

##  The Developer's Filesystem Map

- `src/lib/kyc.ts`: **The Logic Hub**. Contains the wrapped SDK calls and Stacks transaction logic.
- `src/components/KYCRegistration.tsx`: **The UI Core**. A massive MUI Stepper that manages the entire lifecycle state.
- `src/config/protocolRequirements.ts`: **The Rule Book**. Defines the constraints (e.g., "Must be 18", "Must be from the US") that the ZK-proof must satisfy.
- `src/components/Vault.tsx`: **The Real-World Use Case**. A "protected" component that checks for valid KYC before allowing access.

---

##  How to Learn from this Example

1.  **Watch the Console**: We've left descriptive debug logs throughout the flow. Open your DevTools to see the MiMC commitments and ZK-job IDs in real-time.
2.  **Experiment with Requirements**: Change the `min_age` in `protocolRequirements.ts` and watch the ZK-circuit fail (or pass) based on your passport data.
3.  **Check Persistence**: Start the KYC process, refresh the page, and realize the SDK effortlessly resumes the ZK-job from the same point.

---

##  Setup & Launch

```bash
# Install dependencies
npm install

# Run the dev server
npm run dev
```

*Note: Ensure your local Attester and Prover backend services are running before testing the full flow.*
