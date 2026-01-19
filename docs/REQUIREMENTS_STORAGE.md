# Protocol Requirements Storage: How Protocols Define What They Need

Every protocol that uses Noah-v2 has requirements. Maybe you need users to be over 21, or only allow users from specific countries, or require accreditation. The question is: where do you store these requirements?

The good news: **you have options**, and most of them don't require a backend! This guide walks through all the options, from the simplest to the most complex, so you can choose what works best for your protocol.

## The Simple Answer: Start with Static Config

For 90% of protocols, storing requirements in a static file is the right choice. It's simple, requires no infrastructure, and works immediately. You can always migrate to something more complex later if you need to.

But let's look at all the options so you can make an informed decision.

## Option 1: Static Config File (Recommended for Most Protocols)

**No Backend Required ✅**

This is the simplest approach: define your requirements directly in your code or a configuration file.

### How It Works

You create a simple TypeScript/JavaScript file with your requirements:

```typescript
// config/protocolRequirements.ts
import type { ProtocolRequirements } from 'noah-clarity';

export const MY_PROTOCOL_REQUIREMENTS: ProtocolRequirements = {
  min_age: 21,
  allowed_jurisdictions: [1], // US only
  require_accreditation: true,
};

export async function getProtocolRequirements(protocolName: string) {
  switch (protocolName) {
    case 'my-protocol':
      return MY_PROTOCOL_REQUIREMENTS;
    default:
      return {
        min_age: 18,
        allowed_jurisdictions: [1, 2, 3],
        require_accreditation: false,
      };
  }
}
```

Then users fetch requirements like this:
```typescript
const requirements = await getProtocolRequirements('my-protocol');
// Returns: { min_age: 21, allowed_jurisdictions: [1], require_accreditation: true }
```

### Pros
- ✅ Zero infrastructure - no servers, no databases
- ✅ Works immediately - just define and use
- ✅ Simple to understand and maintain
- ✅ No external dependencies
- ✅ Version controlled in git

### Cons
- ⚠️ Requires code deployment to update requirements
- ⚠️ Updates need to be done by developers (no admin UI)

### Best For
- Small to medium protocols
- Requirements that don't change frequently
- Teams that want the simplest possible setup
- Getting started quickly

## Option 2: Static JSON File (Hosted with Frontend)

**No Backend Required ✅**

Store requirements in a JSON file that's served from your frontend's public directory. This makes updates easier (just change the JSON file) without requiring code changes.

### How It Works

Create a JSON file in your frontend's public directory:

```json
// public/requirements/my-protocol.json
{
  "min_age": 21,
  "allowed_jurisdictions": [1],
  "require_accreditation": true
}
```

Then fetch it:
```typescript
export async function getProtocolRequirements(protocolName: string) {
  const response = await fetch(`/requirements/${protocolName}.json`);
  return await response.json();
}
```

### Pros
- ✅ No backend needed
- ✅ Easy to update - just edit the JSON file
- ✅ No code changes required for updates
- ✅ Can be versioned in git
- ✅ Non-developers can update (if they have file access)

### Cons
- ⚠️ Requires frontend deployment to update
- ⚠️ Still requires file system access

### Best For
- Protocols that want simple file-based updates
- Teams comfortable with git/deployments
- Protocols that update requirements occasionally (not constantly)

## Option 3: IPFS (Decentralized Storage)

**No Backend Required ✅**

Store requirements on IPFS (InterPlanetary File System) for truly decentralized storage. This is great for protocols that want to be fully decentralized.

### How It Works

1. Upload your requirements JSON to IPFS
2. Get back an IPFS hash (like `QmYourHashHere...`)
3. Fetch requirements using the hash:

```typescript
export async function getProtocolRequirements(protocolName: string) {
  const ipfsHash = 'QmYourIPFSHashHere'; // Your protocol's IPFS hash
  const response = await fetch(`https://ipfs.io/ipfs/${ipfsHash}`);
  return await response.json();
}
```

### Pros
- ✅ No backend needed
- ✅ Decentralized - no single point of failure
- ✅ Immutable - each version gets a new hash
- ✅ Censorship-resistant
- ✅ Can be pinned to multiple gateways

### Cons
- ⚠️ Requires IPFS knowledge and setup
- ⚠️ Updates require publishing a new hash (and updating your code/config with the new hash)
- ⚠️ May need to run an IPFS node or use a gateway

### Best For
- Fully decentralized protocols
- Protocols wanting censorship resistance
- Protocols with IPFS infrastructure already
- Protocols that value decentralization over ease of updates

## Option 4: CDN (Static File Hosting)

**No Backend Required ✅**

Host requirements JSON on a CDN (Content Delivery Network) like Cloudflare, AWS CloudFront, or similar. This gives you fast, global access with easy updates.

### How It Works

1. Upload requirements JSON to your CDN
2. Get a URL like `https://cdn.yourprotocol.com/requirements/my-protocol.json`
3. Fetch from that URL:

```typescript
export async function getProtocolRequirements(protocolName: string) {
  const response = await fetch(
    `https://cdn.yourprotocol.com/requirements/${protocolName}.json`
  );
  return await response.json();
}
```

### Pros
- ✅ No backend needed (CDN is just static file hosting)
- ✅ Fast - CDN caching means quick responses globally
- ✅ Easy to update - just upload a new file
- ✅ Can be updated by non-developers (if they have CDN access)
- ✅ Global distribution

### Cons
- ⚠️ Requires CDN setup (though many services make this easy)
- ⚠️ May have costs (usually minimal for small files)
- ⚠️ Requires file upload access

### Best For
- Protocols wanting fast, global access
- Teams with CDN access (Cloudflare, AWS, etc.)
- Protocols that update requirements regularly
- Protocols that want easy updates without code deployments

## Option 5: API Endpoint (Requires Backend)

**Backend Required ⚠️**

Store requirements in a database and serve them via an API endpoint. This gives you the most flexibility but requires backend infrastructure.

### How It Works

You build a backend API that serves requirements:

```typescript
export async function getProtocolRequirements(protocolName: string) {
  const response = await fetch(
    `https://api.yourprotocol.com/protocols/${protocolName}/requirements`
  );
  return await response.json();
}
```

Your backend might store requirements in a database and serve them, potentially with an admin UI for updates.

### Pros
- ✅ Real-time updates - change requirements instantly
- ✅ Can have admin UI for non-technical team members
- ✅ Can track changes/history
- ✅ Can support A/B testing different requirements
- ✅ Most flexible approach

### Cons
- ❌ Requires backend infrastructure
- ❌ Requires database
- ❌ Requires API development
- ❌ More complex to set up and maintain
- ❌ Ongoing costs (hosting, database)
- ❌ More things that can break

### Best For
- Large protocols with existing backend infrastructure
- Requirements that change multiple times per day
- Protocols needing admin UI for non-technical staff
- Protocols that need to track requirement changes
- Protocols with complex requirement logic

## Comparison: Which Should You Choose?

| Option | Backend Needed? | Update Method | Complexity | Cost | Best For |
|--------|----------------|---------------|------------|------|----------|
| Static Config | ❌ No | Code deployment | Low | Free | Most protocols |
| Static JSON | ❌ No | File deployment | Low | Free | Simple updates |
| IPFS | ❌ No | New IPFS hash | Medium | Free/Low | Decentralized protocols |
| CDN | ❌ No | File upload | Low | Low | Frequent updates |
| API | ✅ Yes | API call | High | Medium | Complex protocols |

## Recommendations

### For Most Protocols: Start with Option 1 or 2

**My recommendation:** Start with Static Config (Option 1) or Static JSON File (Option 2). These are:
- Simple to set up
- Require no infrastructure
- Work immediately
- Easy to understand

You can always migrate to a more complex solution later if you need to. Most protocols never need more than static files.

### When to Consider Other Options

**Consider IPFS if:**
- Your protocol values decentralization above all else
- You already have IPFS infrastructure
- Censorship resistance is important

**Consider CDN if:**
- You update requirements regularly (weekly or more)
- You want fast, global access
- You have CDN access (many teams already do)

**Consider API only if:**
- Requirements change multiple times per day
- You need an admin UI for non-technical staff
- You already have backend infrastructure
- You need to track requirement changes/history

### Migration Path

Here's a sensible progression as your protocol grows:

1. **Start:** Static Config (Option 1) - Get something working quickly
2. **Grow:** Static JSON File (Option 2) - Easier updates
3. **Scale:** CDN (Option 4) - Fast, global access with easy updates
4. **Complex:** API Endpoint (Option 5) - Only if you really need it

Most protocols can stop at step 1 or 2 and never need more.

## Example: Simple Protocol Setup

Here's a complete, simple setup that works for most protocols:

```typescript
// config/protocolRequirements.ts
import type { ProtocolRequirements } from 'noah-clarity';

export const PROTOCOL_REQUIREMENTS: ProtocolRequirements = {
  min_age: 21,
  allowed_jurisdictions: [1], // US only
  require_accreditation: true,
};

export async function getProtocolRequirements(): Promise<ProtocolRequirements> {
  // For now, just return our requirements
  // Later, you could fetch from JSON file, IPFS, CDN, or API
  return PROTOCOL_REQUIREMENTS;
}
```

That's it! This simple approach works for 90% of protocols and requires zero backend infrastructure. 🎉

## Making the Choice

Don't overthink it. Start simple. You can always add complexity later if you need it, but you can't easily remove complexity once it's there.

**Start with Static Config.** If you find yourself needing to update requirements frequently or want easier updates, move to Static JSON File. Only consider the more complex options if you have specific needs that simpler approaches can't meet.
