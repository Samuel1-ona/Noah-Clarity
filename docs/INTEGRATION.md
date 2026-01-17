# Integration Guide

This guide shows how to integrate Noah-v2 KYC into your Stacks protocol.

## Basic Integration

### 1. Install the SDK

```bash
npm install @noah-v2/sdk
```

### 2. Initialize the SDK

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

### 3. Check KYC in Your Contract

In your Clarity contract, check KYC before allowing actions:

```clarity
(define-public (your-protocol-function)
  (let ((kyc-status (contract-call? .kyc-registry has-kyc? tx-sender)))
    (asserts! (is-some kyc-status) ERR_KYC_REQUIRED)
    ;; Your protocol logic here
  )
)
```

### 4. Check KYC in Frontend

```typescript
const isValid = await sdk.contract.isKYCValid(userAddress);
if (!isValid) {
  // Show KYC required message
  // Redirect to KYC flow
}
```

## Example: DeFi Protocol

See `packages/noah-sdk/src/examples/example-protocol.ts` for a complete example.

```typescript
import { checkKYCBeforeDeposit, requireKYC } from '@noah-v2/sdk/examples/example-protocol';

// Before allowing deposit
const canDeposit = await checkKYCBeforeDeposit(userAddress);
if (!canDeposit) {
  throw new Error('KYC required');
}

// Or use the helper
await requireKYC(userAddress);
```

## Example: DAO

See `packages/noah-sdk/src/examples/example-dao.ts` for a complete example.

```typescript
import { checkKYCBeforeVote } from '@noah-v2/sdk/examples/example-dao';

// Before allowing vote
const canVote = await checkKYCBeforeVote(userAddress);
if (!canVote) {
  throw new Error('KYC required to vote');
}
```

## Clarity Contract Integration

Reference the example contracts in `kyc-registry/contracts/examples/` (if created):

- `example-defi.clar` - DeFi protocol example
- `example-dao.clar` - DAO example

## Best Practices

1. **Always check KYC on-chain** - Don't rely solely on frontend checks
2. **Check expiry** - Use `is-kyc-valid?` to ensure KYC hasn't expired
3. **Handle errors gracefully** - Show clear messages when KYC is required
4. **Cache KYC status** - Check once per session, not on every action
5. **Provide KYC flow** - Guide users to complete KYC if needed

