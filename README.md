# Noah-v2: Privacy-Preserving KYC on Stacks Blockchain

Imagine you're building a DeFi protocol that requires users to verify their identity and meet certain criteria (like being over 18, living in specific countries, or having accreditation). Traditional KYC solutions force users to share all their personal information with every protocol they want to use. Not only is this a privacy nightmare, but it also creates unnecessary friction for users.

**Noah-v2 solves this problem.** It's a privacy-preserving KYC system built for the Stacks blockchain that lets users prove they meet a protocol's requirements without revealing any personal information. Think of it like showing your ID to a bouncer—they can verify you're old enough, but they don't need to know your exact age, address, or any other details.

## What Makes This Different?

Most KYC systems work like this: "Tell me everything about yourself, and I'll decide if you can use my service." Noah-v2 works differently: "Prove you meet my requirements, but keep your personal data private."

Here's the magic: users generate **zero-knowledge proofs** that mathematically demonstrate they satisfy a protocol's requirements, without revealing what those credentials actually are. The protocol just knows "this person meets my requirements" and grants access. The user's age, location, and other sensitive information remain completely private.

## Real-World Use Cases

Let's explore some scenarios where Noah-v2 shines:

### Use Case 1: Decentralized Exchange (DEX)

**The Problem:** A DEX needs to comply with regulations requiring users to be at least 18 years old and located in allowed jurisdictions. Traditional KYC would require users to upload documents to every exchange they want to use.

**With Noah-v2:** Users complete KYC once (privately). When they want to trade on Exchange A (which requires 18+ in US/EU), they generate a proof showing they meet those requirements. Exchange B (which requires 21+ in US only) gets a different proof. Both exchanges verify the user meets their requirements, but neither knows the user's exact age or location.

### Use Case 2: Lending Protocol

**The Problem:** A lending protocol needs to verify that borrowers are accredited investors (in the US, this means having over $1M in assets or high income). They also need to restrict access to certain jurisdictions.

**With Noah-v2:** Accredited investors can prove their status without revealing their net worth or income. The protocol verifies the proof and grants access to high-value lending products, while users maintain complete financial privacy.

### Use Case 3: Gaming Platform with Age Restrictions

**The Problem:** An NFT gaming platform needs to verify users are over 18 to comply with regulations, but doesn't want to store sensitive identity documents.

**With Noah-v2:** Users prove they're over 18 without revealing their exact age or birthdate. The gaming platform can confidently allow access while users keep their personal information private.

### Use Case 4: Multi-Protocol User Journey

**The Scenario:** Alice wants to use three different protocols:
- Protocol A: Requires 21+, US only, accredited
- Protocol B: Requires 18+, any jurisdiction
- Protocol C: Requires 25+, EU/UK only, accredited

**Traditional Approach:** Alice would need to upload her documents to all three protocols separately, sharing her full identity information with each one.

**With Noah-v2:** Alice completes KYC once. She generates proofs tailored to each protocol's requirements. Each protocol verifies she meets their specific needs, but none of them know her actual age, location, or accreditation status. Alice uses all three protocols seamlessly while maintaining complete privacy.

## How It Works: The Big Picture

Let's break down how Noah-v2 works from a user's perspective:

```
┌─────────────────────────────────────────────────────────────┐
│                    USER'S JOURNEY                           │
└─────────────────────────────────────────────────────────────┘

Step 1: User Completes Initial KYC (One-Time)
──────────────────────────────────────────────
User → Attester Service (off-chain)
  • User submits identity documents
  • Attester verifies identity
  • Attester issues credential
  
Step 2: User Wants to Use a Protocol
─────────────────────────────────────
User → Protocol
  • "I want to use your service"
  • Protocol: "Here are my requirements"
  
Step 3: User Generates Privacy Proof
────────────────────────────────────
User → Proof Service
  • User generates ZK proof matching protocol requirements
  • Proof proves user meets requirements WITHOUT revealing data
  
Step 4: Attester Validates and Signs
─────────────────────────────────────
User → Attester Service
  • User sends proof for verification
  • Attester verifies proof is valid
  • Attester signs commitment (attestation)
  
Step 5: User Registers On-Chain
────────────────────────────────
User → Stacks Blockchain
  • User submits commitment + signature
  • KYC Registry stores: user address + commitment + attester ID
  • This is PUBLIC but reveals nothing about user's data
  
Step 6: Protocol Checks Access
──────────────────────────────
Protocol → KYC Registry (on-chain)
  • Protocol checks: "Does this user have valid KYC?"
  • Registry: "Yes, they're verified by an attester"
  • Protocol grants access ✅
```

The beautiful part? Once a user registers their KYC on-chain, **any protocol can check it**. Users don't need to register separately for each protocol—they do it once and reuse it everywhere.

## System Architecture

Noah-v2 is built with several key components working together:

```
┌────────────────────────────────────────────────────────────────────┐
│                         SYSTEM ARCHITECTURE                         │
└────────────────────────────────────────────────────────────────────┘

┌──────────────┐
│   Frontend   │  User interface (React/TypeScript)
│   (Browser)  │  • KYC registration flow
└──────┬───────┘  • Protocol integration examples
       │
       │ HTTP/REST
       │
       ├──────────────┐
       │              │
       ↓              ↓
┌──────────────┐  ┌──────────────┐
│ Proof Service│  │Attester      │
│ (Go/gnark)   │  │Service (Go)  │
│              │  │              │
│ Port: 8080   │  │ Port: 8081   │
│              │  │              │
│ • Generates  │  │ • Verifies   │
│   ZK proofs  │  │   identity  │
│ • Groth16    │  │ • Signs      │
│   circuits   │  │   commitments│
└──────────────┘  └──────┬───────┘
                         │
                         │ secp256k1 signatures
                         ↓
                  ┌──────────────┐
                  │  Stacks      │
                  │  Blockchain  │
                  │              │
                  │ ┌──────────┐ │
                  │ │KYC       │ │
                  │ │Registry  │ │
                  │ │Contract  │ │
                  │ └──────────┘ │
                  │              │
                  │ ┌──────────┐ │
                  │ │Attester  │ │
                  │ │Registry  │ │
                  │ │Contract  │ │
                  │ └──────────┘ │
                  └──────────────┘
                         │
                         │ SDK (TypeScript)
                         │ contract.isKYCValid()
                         ↓
                  ┌──────────────┐
                  │  Protocols   │
                  │  (Your App)  │
                  │              │
                  │ Check KYC →  │
                  │ Grant Access │
                  └──────────────┘
```

### Component Breakdown

1. **Frontend Application** (`frontend-example/`)
   - Demo application showing how to integrate Noah-v2
   - Complete user flows for KYC registration
   - Examples of protocol integration patterns
   - Built with React and TypeScript

2. **Proof Service** (`backend/prover/`)
   - REST API built in Go
   - Uses gnark library for zero-knowledge proofs
   - Generates Groth16 proofs based on user credentials and protocol requirements
   - Runs on port 8080

3. **Attester Service** (`backend/attester/`)
   - **This is the running backend service** - a Go REST API that runs on port 8081
   - Credential issuance and verification service
   - Verifies user identity documents (off-chain)
   - Signs commitments with secp256k1 signatures
   - Manages revocation lists
   - **Note:** "Attester" refers to the entity/organization running this service. Multiple attesters can exist in the system, each running their own Attester Service.

## Prover and Attester Service Architecture

Let's dive deeper into how the Proof Service and Attester Service work together:

### Proof Service Architecture

The Proof Service is responsible for generating zero-knowledge proofs. Here's how it works:

```
┌─────────────────────────────────────────────────────────────┐
│                    PROOF SERVICE ARCHITECTURE                │
└─────────────────────────────────────────────────────────────┘

User/Application
    │
    │ POST /proof/generate
    │ {
    │   age, jurisdiction, is_accredited, identity_data, nonce,
    │   min_age, allowed_jurisdictions, require_accreditation
    │ }
    ↓
┌──────────────────┐
│  Proof Service   │
│  (Port 8080)     │
│                  │
│  1. Receives     │
│     credentials  │
│     + protocol   │
│     requirements │
│                  │
│  2. Loads ZK     │
│     circuit      │
│     (Go/gnark)   │
│                  │
│  3. Generates    │
│     Groth16      │
│     proof        │
│                  │
│  4. Computes     │
│     commitment   │
│     (MiMC hash)  │
│                  │
│  5. Returns:     │
│     • proof      │
│     • public     │
│       inputs     │
│     • commitment │
└──────────────────┘
    │
    │ Returns JSON response
    ↓
User/Application
    Receives proof ready for attestation
```

**What happens inside:**
1. User sends their credential data (age, jurisdiction, etc.) and protocol requirements
2. Service loads the pre-compiled ZK circuit
3. Circuit generates a zero-knowledge proof using Groth16
4. Service computes a commitment hash (MiMC hash of the credentials)
5. Service returns the proof, public inputs, and commitment

### Attester Service Architecture

The Attester Service verifies proofs and signs commitments. Here's how it works:

```
┌─────────────────────────────────────────────────────────────┐
│                  ATTESTER SERVICE ARCHITECTURE               │
└─────────────────────────────────────────────────────────────┘

User/Application
    │
    │ POST /credential/attest
    │ {
    │   commitment, public_inputs, proof, user_id
    │ }
    ↓
┌──────────────────┐
│ Attester Service │
│  (Port 8081)     │
│                  │
│  1. Receives     │
│     proof +      │
│     commitment   │
│                  │
│  2. Verifies     │
│     proof using  │
│     verifying    │
│     key          │
│                  │
│  3. Checks proof │
│     matches      │
│     requirements │
│                  │
│  4. Signs        │
│     commitment   │
│     with         │
│     secp256k1    │
│     private key  │
│                  │
│  5. Returns:     │
│     • signature  │
│     • attester   │
│       ID         │
│     • commitment │
└──────────────────┘
    │
    │ Returns JSON response
    ↓
User/Application
    Receives signed attestation ready for on-chain registration
```

**What happens inside:**
1. User sends proof, commitment, and public inputs
2. Attester verifies the proof is mathematically valid using the verifying key
3. Attester checks that the proof matches the protocol requirements (from public inputs)
4. Attester signs the commitment with its private key (secp256k1 signature)
5. Attester returns the signature, its ID, and the commitment

### How They Work Together

Here's the complete flow showing how both services interact:

```
┌─────────────────────────────────────────────────────────────┐
│           PROVER + ATTESTER INTEGRATION FLOW                 │
└─────────────────────────────────────────────────────────────┘

Step 1: Generate Proof
──────────────────────
User → Proof Service
  • Sends: credentials + protocol requirements
  • Proof Service generates ZK proof
  • Returns: proof + public_inputs + commitment
  ↓
  
Step 2: Get Attestation
────────────────────────
User → Attester Service
  • Sends: proof + public_inputs + commitment
  • Attester verifies proof is valid
  • Attester checks proof matches requirements
  • Attester signs commitment
  • Returns: signature + attester_id + commitment
  ↓
  
Step 3: Register On-Chain
──────────────────────────
User → Stacks Blockchain
  • Uses SDK to call register-kyc()
  • Sends: commitment + signature + attester_id
  • KYC Registry stores registration
  • Transaction confirmed
  ↓
  
✅ User has KYC registered on-chain
```

**Key Points:**
- **Proof Service** generates proofs but doesn't sign them
- **Attester Service** verifies proofs and signs commitments
- Both services work off-chain (fast, no blockchain fees)
- Only the final registration goes on-chain (one transaction)

4. **ZK Circuits** (`circuit/`)
   - Zero-knowledge proof circuits defined in Go/gnark
   - Verifies: age, jurisdiction, accreditation status, identity
   - Generates proofs that can be verified efficiently

5. **Smart Contracts** (`kyc-registry/contracts/`)
   - **KYC Registry**: Stores user KYC registrations on-chain
   - **Attester Registry**: Manages attester registration and status
   - **Revocation Registry**: Handles credential revocation
   - Written in Clarity (Stacks smart contract language)

6. **TypeScript SDK** (`packages/noah-sdk/`)
   - Easy-to-use library for protocol developers
   - Handles all blockchain interactions
   - Provides simple functions: `isKYCValid()`, `registerKYC()`, etc.
   - Published as `noah-clarity` on npm

## Key Features

### 🔒 Privacy-First Design
Users never share their actual data with protocols. They only prove they meet requirements using cryptographic proofs. Your age, location, and other sensitive information stay completely private.

### ♻️ Reusable Credentials
Complete KYC once, use it everywhere. Once you're registered on-chain, any protocol can verify your KYC status without you needing to register again.

### ⚡ Fast and Efficient
Proof generation happens off-chain, so it's fast. On-chain verification is just a simple signature check—no complex computations on the blockchain.

### 🛡️ Secure Attestation
Attesters verify proofs before signing. Protocols trust the attester's verification, not the proof itself. This creates a secure, trust-minimized system.

### 🌍 Protocol-Specific Requirements
Each protocol can define its own requirements (minimum age, allowed jurisdictions, accreditation needs). Users generate proofs matching exactly what each protocol needs.

### 🔄 Revocation Support
Credentials can be revoked if needed (e.g., if identity documents are compromised). The system supports efficient revocation checking using Merkle trees.

## Quick Start Guide

### Prerequisites

Before you begin, make sure you have:
- **Go 1.21 or higher** - For backend services and circuits
- **Node.js 18 or higher** - For frontend and SDK
- **Clarinet** - For deploying Clarity smart contracts ([installation guide](https://docs.hiro.so/clarinet/))

### Installation

Clone the repository and install dependencies:

```bash
# Clone the repository
git clone <repository-url>
cd Noah-v2

# Install all dependencies
make install

# Or install manually:
cd circuit && go mod download
cd ../backend/prover && go mod download
cd ../backend/attester && go mod download
cd ../../frontend-example && npm install
cd ../packages/noah-sdk && npm install
```

### Running the System

You'll need three terminal windows:

**Terminal 1 - Proof Service:**
```bash
make run-prover
# Or: cd backend/prover && go run main.go
```
The proof service will start on `http://localhost:8080`

**Terminal 2 - Attester Service:**
```bash
make run-attester
# Or: cd backend/attester && go run main.go
```
The attester service will start on `http://localhost:8081`

**Terminal 3 - Frontend:**
```bash
cd frontend-example
npm run dev
```
The frontend will start (usually on `http://localhost:5173` or similar, depending on your Vite config)

### Deploying Smart Contracts

Deploy the Clarity contracts to Stacks testnet:

```bash
# Using Clarinet
cd kyc-registry
clarinet deploy
```

After deployment, update the contract addresses in:
- `packages/noah-sdk/src/config.ts`
- `frontend-example/src/lib/kyc.ts` (if using environment variables)

## Detailed Flow: How Everything Works Together

Let's walk through what happens when a user wants to use a protocol that requires KYC:

### Phase 1: Initial Setup (One-Time Per User)

```
User wants to use protocols requiring KYC
    ↓
User completes identity verification with Attester (off-chain)
    • User uploads documents
    • Attester verifies identity
    • Attester stores credential data (user keeps this private)
    ↓
User generates a generic zero-knowledge proof
    • Proof Service creates Groth16 proof
    • Proof demonstrates user has valid credentials
    ↓
User requests attestation from Attester
    • Attester verifies the proof is valid
    • Attester signs a commitment with their private key
    • Attester returns signature + commitment
    ↓
User registers KYC on Stacks blockchain
    • User submits transaction: register-kyc(commitment, signature, attester-id)
    • KYC Registry contract stores: {user-address, commitment, attester-id}
    • Transaction confirmed on blockchain
    ↓
✅ User now has KYC registered on-chain
   (This is a one-time process)
```

### Phase 2: Using a Protocol (Each Time User Wants Access)

```
User wants to access Protocol A
    ↓
Protocol A publishes requirements (off-chain)
    Example: { min_age: 21, allowed_jurisdictions: [1], require_accreditation: true }
    ↓
User fetches Protocol A's requirements
    ↓
User generates proof matching Protocol A's requirements
    • User's credential data + Protocol A's requirements → Proof Service
    • Proof Service generates ZK proof
    • Proof proves: user meets Protocol A's requirements
    ↓
User gets attestation (Attester verifies proof matches requirements)
    • Attester verifies the proof
    • Attester signs commitment
    ↓
User registers/updates KYC on-chain (if needed)
    OR User already has KYC registered (can reuse existing)
    ↓
Protocol A checks user's KYC status (on-chain)
    • Protocol calls: isKYCValid?(user-address)
    • KYC Registry checks: user has valid KYC registered
    • Returns: true ✅
    ↓
Protocol A grants access to user
```

### The Beautiful Part: Reusability

Once a user has registered their KYC on-chain, **they can use it with any protocol**:

```
User has KYC registered on-chain
    ↓
User wants to use Protocol B
    → Protocol B checks: isKYCValid?(user-address)
    → Returns: true ✅
    → Protocol B grants access
    (No re-registration needed!)
    ↓
User wants to use Protocol C
    → Protocol C checks: isKYCValid?(user-address)
    → Returns: true ✅
    → Protocol C grants access
    (Still no re-registration needed!)
```

## Integrating Noah-v2 into Your Protocol

Integrating KYC checks into your protocol is straightforward. Here's how:

### Step 1: Install the SDK

```bash
npm install noah-clarity
```

### Step 2: Initialize the SDK

```typescript
import { NoahSDK } from 'noah-clarity';

const sdk = new NoahSDK(
  {
    kycRegistryAddress: 'ST2N04CYE3CQ1S354MZX4KHYJYD4QW25ZW37GQY7J.kyc-registry',
    attesterRegistryAddress: 'ST2N04CYE3CQ1S354MZX4KHYJYD4QW25ZW37GQY7J.attester-registry',
    network: 'testnet', // or 'mainnet'
  },
  {
    appName: 'Your Protocol Name',
  }
);
```

### Step 3: Check KYC Before Allowing Actions

```typescript
// Before allowing a user to perform an action
const hasValidKYC = await sdk.contract.isKYCValid(userAddress);

if (!hasValidKYC) {
  // Show KYC registration flow to user
  showKYCRequiredMessage();
  return;
}

// User has valid KYC, proceed with the action
allowUserAction();
```

That's it! The SDK handles all the complexity of interacting with the blockchain, verifying signatures, and checking attester status.

### Step 4: Define Your Protocol Requirements (Optional)

If you want to specify what your protocol requires, you can define requirements off-chain:

```typescript
// In your protocol's config
const protocolRequirements = {
  min_age: 21,
  allowed_jurisdictions: [1], // US only
  require_accreditation: true,
};

// Users will generate proofs matching these requirements
```

See `docs/REQUIREMENTS_STORAGE.md` for different ways to store and serve requirements (from simple static files to IPFS).

## Project Structure

Here's how the codebase is organized:

```
Noah-v2/
├── circuit/                    # Zero-knowledge proof circuits
│   └── kyc.go                 # Circuit definition (Go/gnark)
│
├── backend/                   # Backend services (Go)
│   ├── prover/                # Proof generation service
│   │   ├── main.go            # Service entry point
│   │   ├── circuit.go         # Circuit management
│   │   └── api.go             # REST API handlers
│   │
│   └── attester/              # Attester service
│       ├── main.go            # Service entry point
│       ├── signer.go          # Signature generation
│       └── api.go             # REST API handlers
│
├── kyc-registry/              # Clarity smart contracts
│   ├── contracts/
│   │   ├── kyc-registry.clar  # Main KYC registry contract
│   │   ├── attester-registry.clar  # Attester management
│   │   └── revocation.clar    # Revocation registry
│   └── contracts.testnet.json # Deployed contract addresses
│
├── packages/
│   └── noah-sdk/              # TypeScript SDK
│       ├── src/
│       │   ├── contract.ts    # Blockchain interactions
│       │   ├── proof.ts       # Proof generation helpers
│       │   ├── wallet.ts      # Wallet integration
│       │   └── types.ts       # TypeScript types
│       └── package.json       # Published as 'noah-clarity'
│
├── frontend-example/          # Example frontend application
│   ├── src/
│   │   ├── components/       # React components
│   │   │   ├── KYCRegistration.tsx  # KYC flow
│   │   │   ├── Vault.tsx     # Example protocol
│   │   │   └── AttesterManagement.tsx  # Attester UI
│   │   ├── lib/
│   │   │   ├── kyc.ts        # KYC integration logic
│   │   │   └── stacks.ts    # Wallet connection
│   │   └── config/
│   │       └── protocolRequirements.ts  # Protocol requirements
│   └── package.json
│
├── docs/                      # Documentation
│   ├── ARCHITECTURE.md       # System architecture details
│   ├── API.md                # Backend API reference
│   ├── INTEGRATION.md        # Integration guide
│   ├── GETTING_STARTED.md    # Setup instructions
│   └── REQUIREMENTS_STORAGE.md  # How protocols store requirements
│
└── examples/                 # Example implementations
    └── vault/                # Simple vault contract example
        ├── contracts/
        │   └── simple-vault.clar
        └── README.md
```

## Development

### Building the Project

```bash
# Build the SDK
cd packages/noah-sdk
npm run build

# Build the frontend
cd ../../frontend-example
npm run build

# Build everything
make build
```

### Running Tests

```bash
# Run Go tests
cd circuit && go test ./...
cd ../backend/prover && go test ./...
cd ../attester && go test ./...

# Run TypeScript tests
cd packages/noah-sdk && npm test
```

### Making Changes

When developing:
1. Make changes to the code
2. Rebuild the SDK if you modified `packages/noah-sdk/`
3. Restart the services you modified
4. Test your changes

## Documentation

For more detailed information, check out:

- **[Architecture Guide](docs/ARCHITECTURE.md)** - Deep dive into system design and components
- **[Getting Started](docs/GETTING_STARTED.md)** - Detailed setup instructions
- **[API Documentation](docs/API.md)** - Complete backend API reference
- **[Integration Guide](docs/INTEGRATION.md)** - Step-by-step integration instructions
- **[Requirements Storage](docs/REQUIREMENTS_STORAGE.md)** - How protocols define and store requirements
- **[How to Run an Attester](docs/HOW_TO_RUN_ATTESTER.md)** - Guide for organizations wanting to become attesters

## Security Considerations

Noah-v2 is designed with security in mind:

- **Proofs are generated off-chain**: Clarity smart contracts can't verify Groth16 proofs directly, so proof generation happens off-chain
- **On-chain verification uses signatures**: The blockchain verifies attester signatures, which is efficient and secure
- **Multi-attester model**: Multiple attesters can exist, reducing trust in any single entity
- **Revocation support**: Credentials can be revoked if compromised
- **Expiration management**: Credentials can have expiration timestamps

## License

MIT License - feel free to use this in your projects!

## Contributing

We welcome contributions! If you find bugs, have feature requests, or want to improve documentation, please open an issue or submit a pull request.

---

**Built for the Stacks blockchain** | **Privacy-preserving KYC** | **Zero-knowledge proofs**
