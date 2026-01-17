# Getting Started with Noah-v2

## Prerequisites

- Go 1.21+
- Node.js 18+
- Clarinet (for Clarity development)

## Setup

### 1. Clone and Install Dependencies

```bash
# Install Go dependencies
cd circuit && go mod download
cd ../backend/prover && go mod download
cd ../attester && go mod download

# Install frontend dependencies
cd ../../frontend && npm install

# Install SDK dependencies
cd ../packages/noah-sdk && npm install
```

### 2. Start Backend Services

#### Proof Service

```bash
cd backend/prover
go run main.go
```

Service runs on `http://localhost:8080`

#### Attester Service

```bash
cd backend/attester
go run main.go
```

Service runs on `http://localhost:8081`

### 3. Deploy Clarity Contracts

```bash
# Using Clarinet
clarinet deploy
```

Update contract addresses in:
- `packages/noah-sdk/src/index.ts`
- `frontend/src/lib/kyc.ts`

### 4. Start Frontend

```bash
cd frontend
npm start
```

Frontend runs on `http://localhost:3000`

## Usage

### For Protocol Developers

1. Install the SDK:
```bash
npm install @noah-v2/sdk
```

2. Initialize the SDK:
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
```

3. Check KYC before allowing actions:
```typescript
const isValid = await sdk.contract.isKYCValid(userAddress);
if (!isValid) {
  throw new Error('KYC required');
}
```

See `packages/noah-sdk/src/examples/` for more examples.

## Development

### Running Tests

```bash
# Go tests
cd circuit && go test ./...
cd ../backend/prover && go test ./...
cd ../attester && go test ./...

# TypeScript tests
cd packages/noah-sdk && npm test
```

### Building

```bash
# Build SDK
cd packages/noah-sdk && npm run build

# Build frontend
cd frontend && npm run build
```

