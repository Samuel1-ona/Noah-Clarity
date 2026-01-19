# Getting Started with Noah-v2: Your First Steps

Welcome! This guide will help you get Noah-v2 up and running on your machine. We'll walk through everything step by step, from installing dependencies to running your first KYC check.

## What You'll Need

Before we begin, make sure you have these tools installed:

- **Go 1.21 or higher** - For running the backend services and circuits. [Download here](https://go.dev/dl/)
- **Node.js 18 or higher** - For the frontend and SDK. [Download here](https://nodejs.org/)
- **Clarinet** - For deploying Clarity smart contracts. [Installation guide](https://docs.hiro.so/clarinet/)

You can verify your installations by running:
```bash
go version    # Should show 1.21 or higher
node --version  # Should show v18 or higher
clarinet --version  # Should show a version number
```

## Step 1: Get the Code and Install Dependencies

First, clone the repository (or navigate to it if you already have it):

```bash
# If you need to clone it:
git clone <repository-url>
cd Noah-v2

# Install all Go dependencies
cd circuit && go mod download
cd ../backend/prover && go mod download
cd ../backend/attester && go mod download

# Install frontend dependencies
cd ../../frontend-example && npm install

# Install SDK dependencies
cd ../packages/noah-sdk && npm install
```

**Tip:** If you prefer, you can use `make install` from the root directory, which does all of this automatically.

## Step 2: Start the Backend Services

Noah-v2 needs two backend services running. You'll want to open two terminal windows for this.

### Terminal 1: Start the Proof Service

The proof service generates zero-knowledge proofs. This is where the cryptographic magic happens.

```bash
cd backend/prover
go run main.go
```

You should see output like:
```
Starting prover service on port 8080
```

The service is now running at `http://localhost:8080`. You can test it's working by visiting `http://localhost:8080/health` in your browser - you should see `{"status":"healthy","service":"noah-prover"}`.

### Terminal 2: Start the Attester Service

The attester service handles identity verification and signing. This is the "trusted authority" that verifies users and signs their proofs.

```bash
cd backend/attester
go run main.go
```

You should see output showing the attester's ID and public key, something like:
```
Attester ID: 1
Public Key: 0x02...
Starting attester service on port 8081
```

The service is now running at `http://localhost:8081`. Test it with `http://localhost:8081/health` - you should see `{"status":"healthy","service":"noah-attester"}`.

**Important:** Keep both terminals open! The services need to keep running while you're using Noah-v2.

## Step 3: Deploy the Smart Contracts

The smart contracts are what store KYC registrations on the Stacks blockchain. You need to deploy them before users can register their KYC.

```bash
cd kyc-registry
clarinet deploy
```

This will deploy the contracts to the Stacks testnet. After deployment, you'll see the contract addresses printed. **Save these addresses** - you'll need them in the next step.

The main contracts you'll see are:
- `kyc-registry` - Stores user KYC registrations
- `attester-registry` - Manages registered attesters
- `revocation` - Handles credential revocation (if used)

## Step 4: Configure Contract Addresses

After deploying contracts, you need to tell the SDK and frontend where to find them. Update these files with your deployed contract addresses:

**For the SDK:** Update `packages/noah-sdk/src/config.ts`
- Find the `kycRegistryAddress` and update it
- Find the `attesterRegistryAddress` and update it

**For the frontend:** Update `frontend-example/src/lib/kyc.ts` (if using environment variables)
- Or set environment variables if your setup uses them

**Tip:** You can also use the default addresses in the config files if you're just testing, but they may not match your deployed contracts.

## Step 5: Start the Frontend (Optional)

If you want to see the full user experience, start the frontend example application:

```bash
cd frontend-example
npm run dev
```

The frontend will start (usually on `http://localhost:5173` or similar, depending on your Vite configuration). Open it in your browser to see:
- KYC registration flow
- Example protocol integration
- Attester management interface

This is a great way to understand how everything works together from a user's perspective.

## Using Noah-v2 in Your Protocol

Now that everything is running, let's talk about how to actually use Noah-v2 in your own protocol.

### Install the SDK

In your protocol's codebase:

```bash
npm install noah-clarity
```

Note: The package is published as `noah-clarity`, not `@noah-v2/sdk`.

### Initialize the SDK

```typescript
import { NoahSDK } from 'noah-clarity';

const sdk = new NoahSDK(
  {
    kycRegistryAddress: 'YOUR_KYC_REGISTRY_ADDRESS',
    attesterRegistryAddress: 'YOUR_ATTESTER_REGISTRY_ADDRESS',
    network: 'testnet', // or 'mainnet' when ready
  },
  {
    appName: 'Your Protocol Name',
  }
);
```

Replace `YOUR_KYC_REGISTRY_ADDRESS` and `YOUR_ATTESTER_REGISTRY_ADDRESS` with the addresses from your contract deployment.

### Check KYC Before Allowing Actions

This is the core integration point. Before allowing users to perform actions (deposit, vote, etc.), check their KYC status:

```typescript
const hasValidKYC = await sdk.contract.isKYCValid(userAddress);

if (!hasValidKYC) {
  // Show a message: "KYC verification required"
  // Redirect to KYC registration flow
  throw new Error('KYC required to proceed');
}

// User has valid KYC, proceed with the action
await performUserAction();
```

That's it! The SDK handles all the complexity of calling contracts, parsing responses, and verifying attester status.

## Development Tips

### Running Tests

Want to make sure everything is working? Run the tests:

```bash
# Test the Go components
cd circuit && go test ./...
cd ../backend/prover && go test ./...
cd ../backend/attester && go test ./...

# Test the SDK (if tests exist)
cd packages/noah-sdk && npm test
```

### Building for Production

When you're ready to build:

```bash
# Build the SDK
cd packages/noah-sdk
npm run build

# Build the frontend
cd ../../frontend-example
npm run build
```

### Common Issues

**"Cannot connect to proof service"**
- Make sure the proof service is running on port 8080
- Check `http://localhost:8080/health` in your browser

**"Cannot connect to attester service"**
- Make sure the attester service is running on port 8081
- Check `http://localhost:8081/health` in your browser

**"Contract not found"**
- Make sure you deployed the contracts with `clarinet deploy`
- Verify the contract addresses in your config files match the deployed addresses
- Check you're using the correct network (testnet vs mainnet)

**"SDK import errors"**
- Make sure you installed with `npm install noah-clarity` (not `@noah-v2/sdk`)
- Check your Node.js version is 18 or higher

## Next Steps

Now that you have everything running:

1. **Try the frontend example** - See how the full user flow works
2. **Read the Integration Guide** - Learn how to integrate into your protocol
3. **Check the API Documentation** - Understand the backend APIs
4. **Explore the Architecture docs** - Deep dive into how everything works

Welcome to Noah-v2! 🎉
