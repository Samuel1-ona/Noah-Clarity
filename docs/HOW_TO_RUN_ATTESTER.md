# How to Run an Attester

So you want to become an attester in the Noah-v2 system? Great! This guide will walk you through everything you need to know about running an Attester Service and becoming part of the decentralized KYC ecosystem.

## How Multiple Attesters Work

### The Concept

**Any organization can run an Attester Service** and become an attester in the system. It's not limited to one organization - there can be many!

This creates a decentralized, competitive ecosystem where:
- Multiple organizations can provide KYC verification services
- Users can choose which attester to use
- Protocols trust any registered attester
- No single point of failure

## The Process: Becoming an Attester

### Step 1: Organization Runs Attester Service

Any organization (Company A, Company B, etc.) can:

1. **Download the Attester Service code**
   - Get the code from `backend/attester/`
   - This is a Go-based REST API service

2. **Run the service**
   ```bash
   cd backend/attester
   go run main.go
   ```

3. **Key generation**
   - The service generates a private/public key pair (or uses a configured one)
   - Save the private key securely - you'll need it to sign commitments
   - The public key is what gets registered on-chain

4. **Service configuration**
   - The service runs on port 8081 by default (configurable)
   - Set environment variables for configuration:
     - `ATTESTER_PORT`: Port to run on (default: 8081)
     - `ATTESTER_PRIVATE_KEY`: Your private key (if you have one)
     - `ATTESTER_ID`: Your attester ID (if you know it)
     - `ATTESTER_REGISTRY`: Address of the attester registry contract
     - `STACKS_NETWORK`: Network to use (testnet/mainnet)

5. **Service is running**
   - Your service is now listening for requests
   - Users can send proofs to your service for verification
   - You can verify proofs and sign commitments

### Step 2: Register On-Chain

The organization registers on the Attester Registry contract:

1. **Get your public key**
   - Your service prints the public key when it starts
   - Or call `GET /info` on your service to get it
   - Format: 33-byte compressed secp256k1 public key (starts with `0x02` or `0x03`)

2. **Get a unique Attester ID**
   - You can query the contract for the next available ID
   - Or work with the contract owner to assign you an ID
   - Each attester gets a unique ID (1, 2, 3, etc.)

3. **Contact the contract owner**
   - The contract owner (who deployed the Attester Registry) needs to register you
   - Provide them with:
     - Your public key
     - Your desired ID (or they can assign one)

4. **On-chain registration**
   - The contract owner calls `add-attester(pubkey, id)` to register you
   - Your public key and ID are stored on-chain
   - You're now an "attester" in the system!

### Step 3: Multiple Attesters Exist

The Attester Registry contract can store many attesters:

```
Attester Registry (On-Chain):
├── ID 1: Company A (pubkey: 0x02aaa...)
├── ID 2: Company B (pubkey: 0x03bbb...)
├── ID 3: Organization C (pubkey: 0x04ccc...)
└── ID 4: Service Provider D (pubkey: 0x05ddd...)
```

Each attester has:
- **Unique ID**: Identifies this specific attester
- **Public key**: Used to verify signatures from this attester
- **Active status**: Can be activated/deactivated by the contract owner

## Real-World Example

Let's say three organizations want to be attesters:

### Company A (KYC Provider)

1. Runs Attester Service:
   ```bash
   cd backend/attester
   export ATTESTER_PORT=8081
   export ATTESTER_ID=1
   go run main.go
   ```

2. Gets output:
   ```
   Attester ID: 1
   Public Key: 0x02aaa1234567890abcdef...
   Starting attester service on port 8081
   ```

3. Registers with contract owner:
   - Provides public key: `0x02aaa1234567890abcdef...`
   - Contract owner calls: `add-attester(0x02aaa..., 1)`

4. Now they can verify users and sign commitments!

### Company B (Identity Verification Service)

1. Runs their own Attester Service:
   ```bash
   cd backend/attester
   export ATTESTER_PORT=8082  # Different port
   export ATTESTER_ID=2
   go run main.go
   ```

2. Gets different key pair:
   ```
   Attester ID: 2
   Public Key: 0x03bbb9876543210fedcba...
   Starting attester service on port 8082
   ```

3. Registers with contract owner:
   - Provides public key: `0x03bbb9876543210fedcba...`
   - Contract owner calls: `add-attester(0x03bbb..., 2)`

4. Now they can also verify users and sign commitments!

### Organization C (Compliance Firm)

1. Runs their own Attester Service
2. Gets their own key pair
3. Registers with ID 3, public key: `0x04ccc...`
4. Now they can verify users too!

**Result:** Three independent attesters, all registered on-chain, all able to verify users!

## How Users Choose Attesters

When a user wants KYC, they interact with attesters like this:

1. **User chooses an attester**
   - User can pick Company A, Company B, or Organization C
   - They might choose based on:
     - Reputation
     - Response time
     - Cost
     - Geographic location
     - Specific verification requirements

2. **User sends proof to attester**
   - User generates a zero-knowledge proof
   - User sends proof to the chosen attester's service endpoint
   - Example: `POST http://company-a.com:8081/credential/attest`

3. **Attester verifies and signs**
   - Attester's service verifies the proof is valid
   - Attester's service checks proof matches requirements
   - Attester's service signs the commitment with their private key
   - Returns signature + attester ID

4. **User registers on-chain**
   - User includes the `attester-id` in the registration
   - KYC Registry stores: `{user, commitment, attester-id: 2}` (for example)
   - The attester ID is permanently linked to this KYC registration

## How Protocols Handle Multiple Attesters

Protocols trust any registered attester:

1. **User registers KYC with attester ID**
   - When a user calls `register-kyc()`, they include an `attester-id`
   - Example: `register-kyc(commitment, signature, attester-id: 2)`

2. **Protocol checks attester status**
   - Protocol (or KYC Registry contract) checks: "Is this attester registered and active?"
   - Calls: `is-attester-active?(attester-id)` → returns `true` or `false`

3. **Protocol verifies signature**
   - Gets the attester's public key: `get-attester-pubkey(attester-id)`
   - Verifies the signature using that public key
   - If valid → KYC is accepted

4. **Protocol grants access**
   - Protocol doesn't care which specific attester it is
   - As long as the attester is registered and active, KYC is valid
   - User gets access ✅

### What This Means

- **Users have choice** - They can pick which attester to use
- **Competition** - Attesters compete on service quality, speed, price
- **Resilience** - If one attester goes down, others can still operate
- **Decentralization** - No single point of failure

## Benefits of Multiple Attesters

### 1. Competition → Better Service

When multiple attesters exist:
- They compete on quality of service
- They compete on response time
- They compete on pricing
- Users benefit from better options

### 2. User Choice → Trusted Providers

Users can:
- Choose attesters they trust
- Switch attesters if needed
- Use different attesters for different protocols
- Pick attesters based on specific needs (geographic location, compliance standards, etc.)

### 3. Resilience → No Single Point of Failure

If one attester:
- Goes offline → Other attesters continue operating
- Has issues → Users can switch to another
- Gets compromised → Can be deactivated, others continue

### 4. Trust Distribution → Decentralization

Protocols don't depend on:
- A single attester
- A single organization
- A single point of control

They trust the system of registered attesters, not any individual one.

### 5. Geographic Diversity → Global Access

Attesters can:
- Serve different regions
- Comply with local regulations
- Offer local language support
- Provide region-specific verification

## Technical Details

### Attester Registry Contract Structure

The Attester Registry contract stores all attesters in a map:

```clarity
(define-map attester-by-id 
  { id: uint } 
  { pubkey: (buff 33), active: bool }
)
```

Each entry contains:
- `id`: Unique identifier (uint)
- `pubkey`: 33-byte compressed secp256k1 public key
- `active`: Boolean indicating if attester is active

### KYC Registration Flow

When a user registers KYC:

1. **User includes attester ID**
   ```
   register-kyc(commitment, signature, attester-id: 2)
   ```

2. **Contract checks attester**
   ```clarity
   is-attester-active?(attester-id) → (ok true)
   ```

3. **Contract gets public key**
   ```clarity
   get-attester-pubkey(attester-id) → (ok 0x03bbb...)
   ```

4. **Contract verifies signature**
   ```clarity
   secp256k1-verify(commitment, signature, pubkey) → true
   ```

5. **KYC is stored**
   ```clarity
   { user: tx-sender, commitment: ..., attester-id: 2 }
   ```

### Managing Attesters

The contract owner can:
- **Add attesters**: `add-attester(pubkey, id)`
- **Deactivate attesters**: `deactivate-attester(id)`
- **Update public keys**: `update-attester-pubkey(pubkey, id)`

Users/protocols can:
- **Check if active**: `is-attester-active?(id)`
- **Get public key**: `get-attester-pubkey(id)`

## Getting Started as an Attester

If you want to run your own Attester Service:

1. **Read the Getting Started guide** - Set up your environment
2. **Run the Attester Service** - Start the backend service
3. **Get your public key** - Call `/info` endpoint or check logs
4. **Contact the contract owner** - Get registered on-chain
5. **Start verifying users** - Accept attestation requests!

## Summary

Multiple organizations can run attester services, register on-chain, and users/protocols can use any of them! This creates a decentralized, competitive ecosystem rather than relying on a single trusted entity.

**Key takeaways:**
- ✅ Anyone can run an Attester Service
- ✅ Each attester gets a unique ID and public key
- ✅ Users can choose which attester to use
- ✅ Protocols trust any registered attester
- ✅ Multiple attesters = competition, resilience, decentralization

The system is designed to support many attesters, creating a healthy ecosystem where users have choice and protocols have resilience.

