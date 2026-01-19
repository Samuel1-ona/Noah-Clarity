# Integration Guide: Adding KYC to Your Stacks Protocol

So you want to add KYC verification to your Stacks protocol? This guide will walk you through the process step by step. Don't worry - it's simpler than it sounds, and we'll make it as straightforward as possible.

## The Quick Version

If you just want to get started quickly, here's the minimal integration:

1. Install the SDK: `npm install noah-clarity`
2. Initialize it with your contract addresses
3. Check `isKYCValid(userAddress)` before allowing actions
4. That's it!

But if you want to understand what's happening and do it properly, read on.

## Step 1: Install the SDK

First things first, add the Noah-v2 SDK to your project:

```bash
npm install noah-clarity
```

**Note:** The package is published as `noah-clarity`, not `@noah-v2/sdk` or anything else.

## Step 2: Set Up the SDK

Import and initialize the SDK in your application:

```typescript
import { NoahSDK } from 'noah-clarity';

const sdk = new NoahSDK(
  {
    kycRegistryAddress: 'STVAH96MR73TP2FZG2W4X220MEB4NEMJHPMVYQNS.KYc-registry',
    attesterRegistryAddress: 'STVAH96MR73TP2FZG2W4X220MEB4NEMJHPMVYQNS.Attester-registry',
    network: 'testnet', // Use 'mainnet' when ready for production
    proverServiceUrl: 'http://localhost:8080', // Optional, defaults shown
    attesterServiceUrl: 'http://localhost:8081', // Optional, defaults shown
  },
  {
    appName: 'Your Protocol Name',
  }
);
```

Replace the contract addresses with your deployed contract addresses. If you haven't deployed contracts yet, see the Getting Started guide.

## Step 3: Check KYC Before Allowing Actions

This is the core of the integration. Before users can perform actions in your protocol (deposit, vote, trade, etc.), check their KYC status:

```typescript
async function handleUserAction(userAddress: string) {
  // Check if user has valid KYC
  const hasValidKYC = await sdk.contract.isKYCValid(userAddress);

  if (!hasValidKYC) {
    // User doesn't have KYC, show message and redirect to KYC flow
    throw new Error('KYC verification is required to use this feature');
    // Or show a UI message and redirect to your KYC registration page
  }

  // User has valid KYC, proceed with the action
  await performUserAction(userAddress);
}
```

That's the basic integration! But let's look at some real-world examples to see how this fits into different types of protocols.

## Example 1: DeFi Protocol (Deposit/Withdraw)

Imagine you're building a DeFi protocol where users deposit STX and earn yield. You want to require KYC for deposits and withdrawals:

```typescript
async function handleDeposit(userAddress: string, amount: bigint) {
  // Check KYC before allowing deposit
  const hasValidKYC = await sdk.contract.isKYCValid(userAddress);
  
  if (!hasValidKYC) {
    throw new Error('KYC verification required to deposit');
  }

  // User has KYC, proceed with deposit
  // ... your deposit logic here ...
}

async function handleWithdraw(userAddress: string, amount: bigint) {
  // Check KYC before allowing withdrawal
  const hasValidKYC = await sdk.contract.isKYCValid(userAddress);
  
  if (!hasValidKYC) {
    throw new Error('KYC verification required to withdraw');
  }

  // User has KYC, proceed with withdrawal
  // ... your withdrawal logic here ...
}
```

## Example 2: DAO (Voting)

For a DAO, you might want to require KYC for voting on proposals:

```typescript
async function castVote(userAddress: string, proposalId: string, vote: 'yes' | 'no') {
  // Check KYC before allowing vote
  const hasValidKYC = await sdk.contract.isKYCValid(userAddress);
  
  if (!hasValidKYC) {
    throw new Error('KYC verification required to vote');
  }

  // User has KYC, record their vote
  // ... your voting logic here ...
}
```

## Example 3: NFT Marketplace

For an NFT marketplace, you might require KYC for listing high-value items:

```typescript
async function listNFT(userAddress: string, nftId: string, price: bigint) {
  // Only require KYC for high-value listings
  const HIGH_VALUE_THRESHOLD = 1000000; // 1 STX in microSTX
  
  if (price > HIGH_VALUE_THRESHOLD) {
    const hasValidKYC = await sdk.contract.isKYCValid(userAddress);
    
    if (!hasValidKYC) {
      throw new Error('KYC verification required for high-value listings');
    }
  }

  // User has KYC (or listing is below threshold), proceed
  // ... your listing logic here ...
}
```

## Integrating with Clarity Contracts

If your protocol logic is in a Clarity smart contract, you'll want to check KYC on-chain as well. Here's how:

```clarity
;; In your contract, check KYC before allowing actions
(define-public (deposit (amount uint))
  (let (
    ;; Check if user has valid KYC
    (kyc-status (contract-call? .kyc-registry is-kyc-valid? tx-sender))
  )
    ;; Assert that KYC is valid
    (asserts! (is-some kyc-status) ERR_KYC_REQUIRED)
    (asserts! (unwrap-panic kyc-status) ERR_KYC_INVALID)
    
    ;; User has valid KYC, proceed with deposit
    ;; ... your deposit logic here ...
  )
)
```

**Important:** Always check KYC on-chain, not just in the frontend. Frontend checks can be bypassed, but on-chain checks cannot.

## Best Practices

### 1. Always Check KYC On-Chain (Both Frontend and Contracts)

**Important clarification:** The SDK's `isKYCValid()` method **does check on-chain** - it calls the contract's read-only function. So when you use the SDK in your frontend, you ARE checking on-chain.

However, if your protocol logic is in a Clarity smart contract (which it should be for security), you should ALSO check KYC on-chain within your contract code.

**For Frontend/TypeScript code:**
```typescript
// ✅ Good: SDK checks on-chain automatically
const hasKYC = await sdk.contract.isKYCValid(userAddress);
// This calls the contract's is-kyc-valid? function on-chain
```

**For Clarity smart contracts:**
```clarity
;; ✅ Also good: Check in your protocol's contract
(asserts! (unwrap-panic (contract-call? .kyc-registry is-kyc-valid? tx-sender)) ERR_KYC_REQUIRED)
```

**Why check in both places?**
- **Frontend check**: Provides good UX - tell users early if they need KYC
- **Contract check**: Provides security - ensures KYC is verified even if someone calls your contract directly

The SDK makes the frontend check easy, but your contract should enforce it too.

### 2. Cache KYC Status in Frontend

KYC status doesn't change frequently, so you don't need to check it on every action. Check once per session or when the user performs their first action:

```typescript
// Check once and cache the result
let userKYCStatus: boolean | null = null;

async function checkKYC(userAddress: string): Promise<boolean> {
  if (userKYCStatus === null) {
    userKYCStatus = await sdk.contract.isKYCValid(userAddress);
  }
  return userKYCStatus;
}
```

### 3. Provide Clear Error Messages

When KYC is required, tell users exactly what they need to do:

```typescript
if (!hasValidKYC) {
  // Show helpful message
  showMessage('KYC verification is required. Please complete KYC registration to continue.');
  // Redirect to KYC flow
  navigateToKYCFlow();
  return;
}
```

### 4. Handle Errors Gracefully

Network errors, contract errors, and other issues can happen. Handle them gracefully:

```typescript
try {
  const hasValidKYC = await sdk.contract.isKYCValid(userAddress);
  if (!hasValidKYC) {
    // Handle missing KYC
  }
} catch (error) {
  // Handle network errors, contract errors, etc.
  console.error('Error checking KYC:', error);
  showMessage('Unable to verify KYC status. Please try again.');
}
```

### 5. Use `isKYCValid` Instead of `hasKYC`

The SDK provides two methods:
- `hasKYC(userAddress)`: Returns detailed KYC status
- `isKYCValid(userAddress)`: Returns a simple boolean (true/false)

For most integrations, use `isKYCValid` - it's simpler and checks that KYC is both present and valid (not expired, etc.).

## Optional: Defining Protocol Requirements

If your protocol has specific requirements (like minimum age, allowed jurisdictions, accreditation needs), you can define them. See the Requirements Storage documentation for details on how to store and serve requirements.

**Note:** Defining requirements is optional. If you don't define specific requirements, users can register KYC with any valid credentials, and you'll just check that they have valid KYC registered.

## Testing Your Integration

1. **Start the backend services** (see Getting Started guide)
2. **Deploy the contracts** (if you haven't already)
3. **Test with a user who doesn't have KYC** - verify they get the "KYC required" message
4. **Complete KYC registration** - use the frontend example or your own flow
5. **Test with a user who has KYC** - verify they can perform actions

## Getting Help

If you run into issues:
- Check the Getting Started guide for setup issues
- Review the API documentation for backend service details
- Look at the frontend example (`frontend-example/`) for working code
- Check the Architecture documentation to understand how everything fits together

Good luck with your integration! 🚀
