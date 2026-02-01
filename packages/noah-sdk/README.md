# Noah-v2 SDK

TypeScript/JavaScript SDK for integrating Noah-v2 KYC system into Stacks protocols.

## Installation

```bash
npm install noah-clarity
```

## Usage

### Basic Setup

```typescript
import { NoahSDK } from 'noah-clarity';

const sdk = new NoahSDK(
  {
    kycRegistryAddress: 'ST2N04CYE3CQ1S354MZX4KHYJYD4QW25ZW37GQY7J.kyc-registry',
    attesterRegistryAddress: 'ST2N04CYE3CQ1S354MZX4KHYJYD4QW25ZW37GQY7J.attester-registry',
    network: 'testnet',
  },
  {
    appName: 'Your Protocol',
  }
);
```

### Async Proof Generation

```typescript
// 1. Submit proof job
const job = await sdk.proof.generateProof(proofRequest);

// 2. Wait for completion
const proofResult = await sdk.proof.waitForProof(job.job_id);

// 3. Get attestation
const attestation = await sdk.proof.requestAttestation({
  commitment: proofResult.commitment,
  public_inputs: proofResult.public_inputs,
  proof: proofResult.proof
});
```

Examples and integration patterns will be available when the SDK is fully implemented.

