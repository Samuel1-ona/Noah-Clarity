# Noah-v2: Privacy-Preserving KYC on Stacks

Noah-v2 is a privacy-preserving KYC system built for the Stacks blockchain, enabling platforms to verify user compliance without exposing personal or sensitive data. Users produce zero-knowledge proofs that confirm they satisfy a platform's KYC requirements.

## Features

- **Privacy-Preserving**: Zero-knowledge proofs ensure personal data remains private
- **Reusable Credentials**: Users can reuse KYC proofs across multiple protocols
- **On-Chain Verification**: Signature-based attestation verified on Stacks
- **Revocation Support**: Merkle tree-based credential revocation
- **Expiration Management**: Automatic expiry checking for credentials
- **Easy Integration**: TypeScript SDK for seamless protocol integration

## Architecture

The system uses:
- **Go with gnark** for ZK circuit definition and proof generation
- **Clarity smart contracts** for on-chain KYC registry and attestation verification
- **TypeScript SDK** for protocol integration
- **React frontend** as a reference implementation

## Key Components

1. **Circuit Layer** (`circuit/`) - ZK circuits in Go/gnark
   - Age verification
   - Jurisdiction checks
   - Accreditation status
   - Identity commitments

2. **Proof Service** (`backend/prover/`) - Go REST API for proof generation
   - Accepts credential data
   - Generates Groth16 proofs
   - Returns proofs and public inputs

3. **Attester Service** (`backend/attester/`) - Credential issuance and signing
   - Issues credentials after verification
   - Signs commitments with secp256k1
   - Manages revocation lists

4. **Clarity Contracts** (`kyc-registry/contracts/`) - On-chain KYC registry
   - KYC registry contract
   - Attester registry
   - Revocation registry
   - Example protocol contracts

5. **SDK** (`packages/noah-sdk/`) - TypeScript SDK for protocols
   - Contract interaction helpers
   - Proof generation utilities
   - Wallet integration

6. **Frontend** (`frontend/`) - Example/demo application
   - Demonstrates SDK usage
   - Shows integration patterns
   - Complete user flows

## Quick Start

### Prerequisites

- Go 1.21+
- Node.js 18+
- Clarinet (for Clarity development)

### Installation

```bash
# Install all dependencies
make install

# Or manually:
cd circuit && go mod download
cd ../backend/prover && go mod download
cd ../backend/attester && go mod download
cd ../../frontend && npm install
cd ../packages/noah-sdk && npm install
```

### Running Services

```bash
# Start proof service (terminal 1)
make run-prover
# Or: cd backend/prover && go run main.go

# Start attester service (terminal 2)
make run-attester
# Or: cd backend/attester && go run main.go

# Start frontend (terminal 3)
cd frontend && npm start
```

### Deploy Contracts

```bash
# Using Clarinet
clarinet deploy
```

Update contract addresses in:
- `packages/noah-sdk/src/index.ts`
- `frontend/src/lib/kyc.ts`

## Usage

### For Protocol Developers

```typescript
import { NoahSDK } from '@noah-v2/sdk';

const sdk = new NoahSDK(
  {
    kycRegistryAddress: 'YOUR_KYC_REGISTRY_ADDRESS',
    attesterRegistryAddress: 'YOUR_ATTESTER_REGISTRY_ADDRESS',
    network: 'testnet',
  },
  {
    appName: 'Your Protocol',
  }
);

// Check KYC before allowing actions
const isValid = await sdk.contract.isKYCValid(userAddress);
if (!isValid) {
  throw new Error('KYC required');
}
```

See `docs/INTEGRATION.md` for detailed integration guide.

## Documentation

- [Architecture](docs/ARCHITECTURE.md) - System architecture overview
- [Getting Started](docs/GETTING_STARTED.md) - Setup and installation
- [API Documentation](docs/API.md) - Backend API reference
- [Integration Guide](docs/INTEGRATION.md) - Protocol integration guide

## Project Structure

```
Noah-v2/
├── circuit/              # ZK circuits (Go/gnark)
├── kyc-registry/        # Clarinet project with contracts
├── backend/             # Backend services (Go)
│   ├── prover/         # Proof generation service
│   └── attester/       # Attester service
├── frontend/            # Example/demo application
├── packages/
│   └── noah-sdk/       # TypeScript SDK
├── docs/               # Documentation
└── tests/              # Integration tests
```

## Development

```bash
# Run tests
make test

# Build all
make build

# Build frontend
make build-frontend

# Build SDK
make build-sdk
```

## License

MIT

