# Testing Revocation Checking

This guide shows how to test the revocation checking feature.

## Prerequisites

1. **Backend Attester Service Running**
   ```bash
   cd backend/attester
   go run main.go
   # Service runs on http://localhost:8081
   ```

2. **Frontend Running**
   ```bash
   cd frontend-example
   npm run dev
   ```

3. **User Has Registered KYC**
   - Complete KYC registration in the frontend
   - You need the commitment value for testing

## Step-by-Step Testing

### Step 1: Get Your KYC Commitment

After completing KYC registration, you'll have a commitment. You can find it:

- In the browser console logs during registration
- From the transaction details on the Stacks explorer
- From the SDK: `sdk.contract.getKYC(userAddress)` returns the commitment

Example commitment format: `0x1ac0bac5c80f2f84ed2822b5df6ca678283400e372b1728835a141a23ed01307`

### Step 2: Verify Access Works (Before Revocation)

1. Navigate to the Vault tab in the frontend
2. You should be able to access it (KYC is valid)
3. `isKYCValid()` should return `true`

### Step 3: Revoke the Credential

Use the backend API to revoke the credential:

```bash
curl -X POST http://localhost:8081/credential/revoke \
  -H "Content-Type: application/json" \
  -d '{
    "commitment": "0xYOUR_COMMITMENT_HERE",
    "reason": "Testing revocation"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Credential revoked",
  "root": "0x..."
}
```

### Step 4: Verify Revocation Status

Check if the commitment is now revoked:

```bash
curl "http://localhost:8081/revocation/check?commitment=0xYOUR_COMMITMENT_HERE"
```

**Expected Response (Revoked):**
```json
{
  "commitment": "0x...",
  "revoked": true
}
```

**Expected Response (Not Revoked):**
```json
{
  "commitment": "0x...",
  "revoked": false
}
```

### Step 5: Verify Access is Blocked (After Revocation)

1. **Refresh the frontend** (or navigate away and back to Vault)
2. Try to access the Vault tab
3. **Access should be blocked** - `isKYCValid()` should return `false`
4. Check the browser console for revocation check logs

**Expected Behavior:**
- Vault shows "KYC Verification Required" or similar error
- Browser console shows: SDK querying `/revocation/check` endpoint
- `isKYCValid()` returns `false` due to revoked status

### Step 6: Verify Revocation Root Updated

Check the revocation Merkle root:

```bash
curl http://localhost:8081/revocation/root
```

**Expected Response:**
```json
{
  "root": "0x...",
  "count": 1
}
```

The `count` should be greater than 0 after revoking at least one credential.

## Testing with Multiple Credentials

1. Register KYC for User A → Get commitment A
2. Register KYC for User B → Get commitment B
3. Revoke commitment A only
4. Verify:
   - User A: Access blocked (`revoked: true`)
   - User B: Access allowed (`revoked: false`)

## Debugging

If revocation checking isn't working:

1. **Check Backend is Running:**
   ```bash
   curl http://localhost:8081/health
   ```

2. **Check SDK Config:**
   - Ensure `attesterServiceUrl` is set in SDK config
   - Default: `http://localhost:8081`

3. **Check Browser Console:**
   - Look for errors from `/revocation/check` endpoint
   - Check if `isCommitmentRevoked()` is being called
   - Verify the commitment value matches

4. **Check Network Tab:**
   - Open browser DevTools → Network tab
   - Look for requests to `/revocation/check`
   - Verify the request URL and response

## Example Test Script

```bash
#!/bin/bash

# Set your commitment here
COMMITMENT="0x1ac0bac5c80f2f84ed2822b5df6ca678283400e372b1728835a141a23ed01307"
ATTESTER_URL="http://localhost:8081"

echo "1. Checking revocation status (before revocation)..."
curl "$ATTESTER_URL/revocation/check?commitment=$COMMITMENT"

echo -e "\n\n2. Revoking credential..."
curl -X POST "$ATTESTER_URL/credential/revoke" \
  -H "Content-Type: application/json" \
  -d "{\"commitment\": \"$COMMITMENT\", \"reason\": \"Test revocation\"}"

echo -e "\n\n3. Checking revocation status (after revocation)..."
curl "$ATTESTER_URL/revocation/check?commitment=$COMMITMENT"

echo -e "\n\n4. Checking revocation root..."
curl "$ATTESTER_URL/revocation/root"
```

## Notes

- Revocation is immediate (no block confirmation needed)
- The revocation service uses in-memory storage (revocations reset on server restart)
- For production, you'd want persistent storage and on-chain root updates

