# Vault Protocol Example

A simple STX vault contract demonstrating KYC integration with Noah-v2.

## KYC Requirements

KYC requirements are defined **off-chain** in `requirements.json`. This approach is more scalable than storing requirements on-chain because:

- ✅ **No transaction costs** - Requirements can be updated without blockchain transactions
- ✅ **Flexible** - Easy to change requirements based on regulations, market conditions, etc.
- ✅ **Fast updates** - Changes take effect immediately (no block confirmation wait)
- ✅ **No on-chain storage costs** - Reduces blockchain bloat
- ✅ **Version control** - Requirements can be versioned and tracked

## Requirements File

The protocol defines its requirements in `requirements.json`:

```json
{
  "min_age": 18,
  "allowed_jurisdictions": [1, 2, 3],
  "require_accreditation": false
}
```

## Production Setup

In production, requirements can be stored in various ways (NO BACKEND REQUIRED):

1. **Static JSON file**: Hosted with your frontend (`/requirements/vault.json`)
2. **IPFS**: Decentralized storage (no backend needed)
3. **CDN**: Static file hosting (Cloudflare, AWS CloudFront, etc.)
4. **Static config**: In your code/config files (simplest)
5. **API endpoint**: Only if you need dynamic updates (requires backend)

**Recommendation**: Start with static JSON file or config - no backend needed!
See `docs/REQUIREMENTS_STORAGE.md` for detailed options.

Users fetch requirements before generating proofs, ensuring their proofs match the protocol's current requirements.

## Integration Flow

1. Protocol publishes requirements (off-chain)
2. User fetches requirements from protocol
3. User generates proof matching requirements
4. User gets attestation from attester
5. User registers commitment on-chain (KYC Registry)
6. Protocol checks on-chain KYC status (`isKYCValid?`)
7. Protocol grants/denies access based on KYC status

## Contract Functions

- `deposit(amount)` - Deposit STX (requires valid KYC)
- `withdraw(amount)` - Withdraw STX (requires valid KYC)
- `get-balance(user)` - Get user's balance

The contract itself doesn't store requirements - it only checks if users have valid KYC registered on the KYC Registry.

