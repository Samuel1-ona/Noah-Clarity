# API Documentation: Talking to the Backend Services

Noah-v2 has two main backend services that your application will interact with: the Proof Service and the Attester Service. This document explains all the endpoints, what they expect, and what they return.

**Base URLs:**
- Proof Service: `http://localhost:8080` (or your deployed URL)
- Attester Service: `http://localhost:8081` (or your deployed URL)

## Proof Service API

The Proof Service is responsible for generating zero-knowledge proofs. This is where user credentials meet protocol requirements to create cryptographic proofs.

### POST /proof/generate

Generate a zero-knowledge proof based on user credentials and protocol requirements.

**When to use:** When a user needs to prove they meet a protocol's requirements without revealing their actual data.

**Request Body:**
```json
{
  "age": "25",
  "jurisdiction": "1",
  "is_accredited": "1",
  "identity_data": "123456789",
  "nonce": "987654321",
  "min_age": "18",
  "allowed_jurisdictions": ["1", "2", "3"],
  "require_accreditation": "0"
}
```

**Field explanations:**
- `age`: User's age (as a string)
- `jurisdiction`: User's jurisdiction ID (as a string, e.g., "1" for US)
- `is_accredited`: "1" if accredited, "0" if not (as a string)
- `identity_data`: User's identity data (numeric value, as a string)
- `nonce`: Random nonce for commitment generation (numeric value, as a string)
- `min_age`: Protocol's minimum age requirement (as a string)
- `allowed_jurisdictions`: Array of allowed jurisdiction IDs (as strings)
- `require_accreditation`: "1" if required, "0" if not (as a string)

**Response (Success):**
```json
{
  "proof": "base64_encoded_proof",
  "public_inputs": [
    "0x123...",
    "0x456...",
    ...
  ],
  "commitment": "0xabcdef...",
  "success": true
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

**Example using curl:**
```bash
curl -X POST http://localhost:8080/proof/generate \
  -H "Content-Type: application/json" \
  -d '{
    "age": "25",
    "jurisdiction": "1",
    "is_accredited": "1",
    "identity_data": "123456789",
    "nonce": "987654321",
    "min_age": "18",
    "allowed_jurisdictions": ["1", "2", "3"],
    "require_accreditation": "0"
  }'
```

### GET /health

Check if the proof service is running and healthy.

**When to use:** Health checks, monitoring, or just verifying the service is up.

**Response:**
```json
{
  "status": "healthy",
  "service": "noah-prover"
}
```

**Example using curl:**
```bash
curl http://localhost:8080/health
```

## Attester Service API

The Attester Service handles identity verification, proof attestation, and credential management. This is the "trusted authority" in the system.

### POST /credential/attest

Create an attestation signature for a proof. This is the most commonly used endpoint - it's what users call after generating a proof.

**When to use:** After a user generates a proof, they need an attestation signature from the attester before they can register on-chain.

**Request Body:**
```json
{
  "commitment": "0xabcdef123456...",
  "public_inputs": [
    "0x123...",
    "0x456...",
    ...
  ],
  "proof": "base64_encoded_proof",
  "user_id": "ST2N04CYE3CQ1S354MZX4KHYJYD4QW25ZW37GQY7J"
}
```

**Field explanations:**
- `commitment`: The commitment hash from the proof generation
- `public_inputs`: Array of public inputs from the proof generation
- `proof`: The base64-encoded proof from the proof generation
- `user_id`: User's Stacks address (principal)

**Response (Success):**
```json
{
  "commitment": "0xabcdef123456...",
  "signature": "0x1234567890abcdef...",
  "attester_id": 1,
  "success": true
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

**Example using curl:**
```bash
curl -X POST http://localhost:8081/credential/attest \
  -H "Content-Type: application/json" \
  -d '{
    "commitment": "0xabcdef...",
    "public_inputs": ["0x123...", "0x456..."],
    "proof": "base64_proof...",
    "user_id": "ST2N04CYE3CQ1S354MZX4KHYJYD4QW25ZW37GQY7J"
  }'
```

### GET /info

Get the attester's ID and public key. Useful for displaying attester information or verifying which attester you're working with.

**When to use:** When you need to know the attester's ID or public key (for example, when registering an attester on-chain).

**Response:**
```json
{
  "attester_id": 1,
  "public_key": "0x021cd704428ec5e83468550cd506b6240ef616cb9877c76be9dee3f3e88d2f2d41"
}
```

**Example using curl:**
```bash
curl http://localhost:8081/info
```

### GET /info/next-available-id

Find the next available attester ID on the blockchain. This is helpful when registering a new attester - it tells you which ID you can use.

**When to use:** Before registering an attester on-chain, to find an available ID.

**Response:**
```json
{
  "next_available_id": 2,
  "suggested_id": 2
}
```

**Example using curl:**
```bash
curl http://localhost:8081/info/next-available-id
```

### GET /health

Check if the attester service is running and healthy.

**When to use:** Health checks, monitoring, or just verifying the service is up.

**Response:**
```json
{
  "status": "healthy",
  "service": "noah-attester"
}
```

**Example using curl:**
```bash
curl http://localhost:8081/health
```

## Error Handling

All endpoints follow a consistent error response format:

```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

Common HTTP status codes:
- `200 OK`: Request succeeded
- `400 Bad Request`: Invalid request (missing fields, wrong format, etc.)
- `500 Internal Server Error`: Something went wrong on the server side

**Best practice:** Always check the `success` field in the response, and handle errors gracefully in your application.

## Authentication

Currently, the services don't require authentication for development. In production, you'll want to:
- Add API keys or authentication tokens
- Rate limit endpoints
- Validate request origins
- Use HTTPS

## Using the SDK Instead

**Important:** Most of the time, you won't call these APIs directly. The Noah-v2 SDK (`noah-clarity`) handles all of this for you. Instead of manually calling `/proof/generate` and `/credential/attest`, you'd do something like:

```typescript
import { NoahSDK } from 'noah-clarity';

const sdk = new NoahSDK(config, walletConfig);

// SDK handles proof generation and attestation internally
const txId = await sdk.contract.registerKYC({
  commitment: "...",
  signature: "...",
  attesterId: 1
}, privateKey);
```

The SDK makes API calls for you, so you don't have to worry about the details. However, if you're building custom integrations or want to understand what's happening under the hood, this API documentation is helpful.

## Rate Limits

Currently, there are no rate limits in place. In production, consider:
- Limiting proof generation requests (they're computationally expensive)
- Rate limiting attestation requests
- Implementing request queuing for high-traffic scenarios
