# Noah-v2 SDK

TypeScript/JavaScript SDK for integrating Noah-v2 KYC system into Stacks protocols.

## Installation

```bash
npm install @noah-v2/sdk
```

## Usage

### Basic Setup

```typescript
import { NoahSDK } from '@noah-v2/sdk';

const sdk = new NoahSDK(
  {
    kycRegistryAddress: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.kyc-registry',
    attesterRegistryAddress: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.attester-registry',
    network: 'testnet',
  },
  {
    appName: 'Your Protocol',
  }
);
```

### Check KYC Status

```typescript
const hasKYC = await sdk.contract.hasKYC(userAddress);
if (hasKYC.hasKYC) {
  // User has KYC
}
```

### Require KYC for Protocol Access

```typescript
const isValid = await sdk.contract.isKYCValid(userAddress);
if (!isValid) {
  throw new Error('KYC required');
}
```

See `src/examples/` for more complete examples.

