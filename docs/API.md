# API Documentation

## Proof Service API

### POST /proof/generate

Generate a ZK proof for KYC verification.

**Request Body:**
```json
{
  "age": "25",
  "jurisdiction": "1",
  "is_accredited": "1",
  "identity_data": "user_identity_hash",
  "nonce": "random_nonce",
  "min_age": "18",
  "allowed_jurisdictions": ["1", "2", "3"],
  "require_accreditation": "0",
  "commitment": "0x..."
}
```

**Response:**
```json
{
  "proof": "serialized_proof",
  "public_inputs": ["..."],
  "commitment": "0x...",
  "success": true
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "noah-prover"
}
```

## Attester Service API

### POST /credential/issue

Issue a new credential to a user.

**Request Body:**
```json
{
  "user_id": "user123",
  "attributes": {
    "age": 25,
    "jurisdiction": 1,
    "accredited": true
  },
  "documents": ["doc_hash_1", "doc_hash_2"]
}
```

**Response:**
```json
{
  "success": true,
  "credential": {
    "user_id": "user123",
    "commitment": "0x...",
    "issued_at": 1234567890,
    "expires_at": 1234567890,
    "attester_id": 1
  }
}
```

### POST /credential/attest

Create an attestation signature for a proof.

**Request Body:**
```json
{
  "commitment": "0x...",
  "public_inputs": ["..."],
  "proof": "serialized_proof",
  "user_id": "user123"
}
```

**Response:**
```json
{
  "commitment": "0x...",
  "signature": "0x...",
  "attester_id": 1,
  "expiry": 1234567890,
  "success": true
}
```

### POST /credential/revoke

Revoke a credential.

**Request Body:**
```json
{
  "commitment": "0x...",
  "reason": "Optional reason"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Credential revoked",
  "root": "merkle_root"
}
```

### GET /revocation/root

Get the current revocation Merkle root.

**Response:**
```json
{
  "root": "0x...",
  "count": 5
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "noah-attester"
}
```

