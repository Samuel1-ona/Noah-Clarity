# Protocol Requirements Storage Options

Protocols define their KYC requirements **off-chain** (not stored on the blockchain). This document explains the different storage options, from simplest to most complex.

## Option 1: Static Config File (Recommended for Simple Protocols)

**No Backend Required ✅**

Store requirements directly in your frontend code or a static JSON file.

### Implementation

```typescript
// config/protocolRequirements.ts
export const VAULT_PROTOCOL_REQUIREMENTS: ProtocolRequirements = {
  min_age: 18,
  allowed_jurisdictions: [1, 2, 3],
  require_accreditation: false,
};

export async function getProtocolRequirements(protocolName: string) {
  switch (protocolName) {
    case 'vault':
      return VAULT_PROTOCOL_REQUIREMENTS;
    default:
      return DEFAULT_REQUIREMENTS;
  }
}
```

### Pros
- ✅ Zero infrastructure
- ✅ No backend needed
- ✅ Works immediately
- ✅ Simple to implement
- ✅ No external dependencies

### Cons
- ⚠️ Requires code deployment to update
- ⚠️ Updates need to be done by developers

### Best For
- Small protocols
- Requirements that don't change frequently
- Getting started quickly

---

## Option 2: Static JSON File (Hosted with Frontend)

**No Backend Required ✅**

Store requirements in a JSON file served from your frontend's public directory.

### Implementation

```typescript
export async function getProtocolRequirements(protocolName: string) {
  const response = await fetch(`/requirements/${protocolName}.json`);
  return await response.json();
}
```

```json
// public/requirements/vault.json
{
  "min_age": 18,
  "allowed_jurisdictions": [1, 2, 3],
  "require_accreditation": false
}
```

### Pros
- ✅ No backend needed
- ✅ Easy to update (just change JSON file)
- ✅ No code changes for updates
- ✅ Can be versioned in git

### Cons
- ⚠️ Requires frontend deployment to update
- ⚠️ Still requires developer access

### Best For
- Protocols that want simple file-based updates
- Teams comfortable with git/deployments

---

## Option 3: IPFS (Decentralized)

**No Backend Required ✅**

Store requirements on IPFS (InterPlanetary File System) for decentralized storage.

### Implementation

```typescript
export async function getProtocolRequirements(protocolName: string) {
  const ipfsHash = 'QmYourIPFSHashHere'; // Protocol's IPFS hash
  const response = await fetch(`https://ipfs.io/ipfs/${ipfsHash}`);
  return await response.json();
}
```

### Pros
- ✅ No backend needed
- ✅ Decentralized (no single point of failure)
- ✅ Immutable (with versioning via new hashes)
- ✅ Censorship-resistant
- ✅ Can be pinned to multiple gateways

### Cons
- ⚠️ Requires IPFS knowledge
- ⚠️ Updates require publishing new hash
- ⚠️ May need IPFS gateway

### Best For
- Decentralized protocols
- Protocols wanting censorship resistance
- Protocols with IPFS infrastructure

---

## Option 4: CDN (Static File Hosting)

**No Backend Required ✅**

Host requirements JSON on a CDN (Cloudflare, AWS CloudFront, etc.).

### Implementation

```typescript
export async function getProtocolRequirements(protocolName: string) {
  const response = await fetch(
    `https://cdn.yourprotocol.com/requirements/${protocolName}.json`
  );
  return await response.json();
}
```

### Pros
- ✅ No backend needed
- ✅ Fast (CDN caching)
- ✅ Easy to update (upload new file)
- ✅ Can be updated by non-developers
- ✅ Global distribution

### Cons
- ⚠️ Requires CDN setup
- ⚠️ May have costs (usually minimal)
- ⚠️ Requires file upload access

### Best For
- Protocols wanting fast, global access
- Teams with CDN access
- Protocols that update requirements regularly

---

## Option 5: API Endpoint

**Backend Required ⚠️**

Store requirements in a database and serve via API endpoint.

### Implementation

```typescript
export async function getProtocolRequirements(protocolName: string) {
  const response = await fetch(
    `https://api.yourprotocol.com/protocols/${protocolName}/requirements`
  );
  return await response.json();
}
```

### Pros
- ✅ Real-time updates (no deployment needed)
- ✅ Can have admin UI for updates
- ✅ Can track changes/history
- ✅ Can support A/B testing
- ✅ Most flexible

### Cons
- ❌ Requires backend infrastructure
- ❌ Requires database
- ❌ Requires API development
- ❌ More complex
- ❌ Ongoing maintenance
- ❌ Costs (hosting, database)

### Best For
- Large protocols
- Requirements that change frequently
- Protocols needing admin UI
- Protocols with existing backend infrastructure

---

## Comparison Table

| Option | Backend Needed? | Update Method | Complexity | Cost | Best For |
|--------|----------------|---------------|------------|------|----------|
| Static Config | ❌ No | Code deployment | Low | Free | Small protocols |
| Static JSON | ❌ No | File deployment | Low | Free | Simple updates |
| IPFS | ❌ No | New IPFS hash | Medium | Free/Low | Decentralized protocols |
| CDN | ❌ No | File upload | Low | Low | Frequent updates |
| API | ✅ Yes | API call | High | Medium | Complex protocols |

---

## Recommendations

### For Most Protocols (Start Here)
**Use Option 1 (Static Config)** or **Option 2 (Static JSON File)**

These are the simplest and require no infrastructure. You can always migrate to a more complex solution later if needed.

### When to Consider API Backend
Only use an API endpoint if:
- Requirements change multiple times per day
- You need an admin UI for non-technical team members
- You need to track requirement changes/history
- You already have backend infrastructure

### Migration Path
1. **Start**: Static Config (Option 1)
2. **Grow**: Static JSON File (Option 2)
3. **Scale**: CDN (Option 4) or IPFS (Option 3)
4. **Complex**: API Endpoint (Option 5)

---

## Example: Simple Protocol Setup

Most protocols should start with this simple setup:

1. Create `requirements.json` in your protocol's public directory
2. Fetch it in your frontend code
3. That's it! No backend needed.

```typescript
// Simple fetch implementation
export async function getProtocolRequirements(protocolName: string) {
  try {
    const response = await fetch(`/requirements/${protocolName}.json`);
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error('Failed to fetch requirements:', error);
  }
  
  // Fallback to defaults
  return DEFAULT_REQUIREMENTS;
}
```

This approach works for 90% of protocols and requires zero backend infrastructure! 🎉

