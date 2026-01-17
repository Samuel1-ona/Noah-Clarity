# Noah-v2 Architecture

## Overview

Noah-v2 is a privacy-preserving KYC system built for the Stacks blockchain. It enables platforms to verify user compliance without exposing personal or sensitive data using zero-knowledge proofs.

## System Architecture

### Components

1. **Circuit Layer** (`circuit/`)
   - ZK circuits defined in Go using gnark
   - Verifies age, jurisdiction, accreditation, and identity
   - Generates Groth16 proofs

2. **Proof Service** (`backend/prover/`)
   - Go REST API for proof generation
   - Accepts credential data and generates ZK proofs
   - Returns proofs and public inputs

3. **Attester Service** (`backend/attester/`)
   - Issues credentials after verifying identity
   - Signs commitments with secp256k1
   - Manages revocation lists using Merkle trees

4. **Clarity Contracts** (`kyc-registry/contracts/`)
   - On-chain KYC registry
   - Attester registry
   - Revocation registry
   - Example protocol contracts

5. **SDK** (`packages/noah-sdk/`)
   - TypeScript SDK for protocol integration
   - Contract interaction helpers
   - Proof generation utilities

6. **Frontend** (`frontend/`)
   - Example/demo application
   - Demonstrates SDK usage
   - Shows integration patterns

## Data Flow

1. User submits KYC documents to attester
2. Attester verifies identity and issues credential
3. User generates ZK proof using proof service
4. Attester verifies proof and signs commitment
5. User registers KYC on-chain with signature
6. Protocols check KYC status before allowing actions

## Security Considerations

- Proofs are generated off-chain (Clarity cannot verify Groth16)
- On-chain verification uses signature-based attestation
- Revocation managed via Merkle trees
- Credentials have expiration timestamps
- Multi-attester model reduces trust requirements

