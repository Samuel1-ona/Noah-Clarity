# Noah-v2 Backend

Zero-knowledge proof-based KYC attestation system with privacy-preserving credential verification.

## Architecture

The backend consists of two microservices:

### 1. **Prover Service** (`prover/`)
Generates zero-knowledge proofs for KYC credentials using Groth16.

**Responsibilities:**
- Compile ZK circuits
- Generate proofs from user credentials
- Manage proving/verifying keys

**Port:** `8080` (default)

### 2. **Attester Service** (`attester/`)
Verifies proofs and issues on-chain attestations.

**Responsibilities:**
- Verify ZK proofs
- Sign commitments
- Issue credentials
- Manage revocations
- Interact with Stacks blockchain

**Port:** `8081` (default)

---

## Quick Start

### Prerequisites
- Go 1.21+
- Stacks blockchain access (testnet/mainnet)

### Installation

```bash
# Clone repository
cd backend

# Install dependencies
cd attester && go mod download
cd ../prover && go mod download
```

### Running Services

#### Prover Service
```bash
cd prover
go run .
```

#### Attester Service
```bash
cd attester
export ATTESTER_PRIVATE_KEY="your-private-key"
go run .
```

---

## Configuration

Both services use environment variables:

### Prover
| Variable | Default | Description |
|----------|---------|-------------|
| `PROVER_PORT` | `8080` | HTTP server port |
| `CIRCUIT_PATH` | `./circuit` | Path to circuit files |
| `PROVING_KEY_PATH` | `./keys/proving.key` | Proving key location |
| `VERIFYING_KEY_PATH` | `./keys/verifying.key` | Verifying key location |
| `LOG_LEVEL` | `info` | Logging level (debug/info/warn/error) |
| `ENVIRONMENT` | `development` | Environment (development/production) |

### Attester
| Variable | Default | Description |
|----------|---------|-------------|
| `ATTESTER_PORT` | `8081` | HTTP server port |
| `ATTESTER_PRIVATE_KEY` | *required* | Stacks private key |
| `ATTESTER_ID` | `1` | Attester ID (auto-discovered if not set) |
| `ATTESTER_REGISTRY` | `ST2N04...attester-registry` | Contract address |
| `STACKS_NETWORK` | `testnet` | Stacks network (testnet/mainnet) |
| `VERIFYING_KEY_PATH` | `../prover/keys/verifying.key` | Verifying key location |
| `LOG_LEVEL` | `info` | Logging level |
| `ENVIRONMENT` | `development` | Environment |

---

## API Endpoints

### Prover Service

#### Generate Proof
```http
POST /proof/generate
Content-Type: application/json

{
  "age": "25",
  "jurisdiction": "1",
  "is_accredited": "1",
  "identity_data": "12345",
  "nonce": "67890",
  "min_age": "18",
  "jurisdiction_root": "0x...",
  "require_accreditation": "0",
  "merkle_path": [...],
  "merkle_helper": [...]
}
```

**Response:**
```json
{
  "proof": "base64-encoded-proof",
  "public_inputs": ["0x...", "0x...", "0x...", "0x..."],
  "commitment": "0x...",
  "success": true
}
```

#### Health Check
```http
GET /health
```

#### Metrics
```http
GET /metrics
```

### Attester Service

#### Create Attestation
```http
POST /attest
Content-Type: application/json

{
  "commitment": "0x...",
  "proof": "base64-encoded-proof",
  "public_inputs": ["0x...", "0x...", "0x...", "0x..."]
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

#### Revoke Credential
```http
POST /revoke
Content-Type: application/json

{
  "commitment": "0x...",
  "reason": "User requested"
}
```

#### Get Revocation Root
```http
GET /revocation/root
```

#### Health Check
```http
GET /health
```

#### Metrics
```http
GET /metrics
```

---

## Monitoring

### Prometheus Metrics

Both services expose Prometheus metrics at `/metrics`:

**HTTP Metrics:**
- `http_requests_total` - Total HTTP requests
- `http_request_duration_seconds` - Request latency
- `http_requests_in_flight` - Active requests

**Proof Metrics:**
- `proof_generation_total` - Proof generation attempts
- `proof_generation_duration_seconds` - Proof generation time
- `proof_verification_total` - Proof verification attempts
- `proof_verification_duration_seconds` - Proof verification time

**Circuit Metrics:**
- `circuit_initialized` - Circuit initialization status

### Health Checks

- `/health` - Detailed health status with component checks
- `/health/ready` - Readiness probe (Kubernetes)
- `/health/live` - Liveness probe (Kubernetes)

---

## Development

### Running Tests
```bash
# Attester tests
cd attester
go test -v ./...

# Prover tests
cd prover
go test -v ./...
```

### Building
```bash
# Build attester
cd attester
go build -o attester

# Build prover
cd prover
go build -o prover
```

### Docker (Coming Soon)
```bash
docker-compose up
```

---

## Security

### Rate Limiting
- Per-IP rate limiting: 100 requests/minute
- Configurable via middleware

### Input Validation
- Request size limit: 10MB
- Content-Type validation
- JSON schema validation

### Security Headers
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: enabled
- Content-Security-Policy: default-src 'self'

### Secret Management
- Private keys via environment variables
- Support for external secret managers (planned)

---

## Architecture Decisions

### Why Microservices?
- **Separation of Concerns**: Proof generation and attestation are distinct responsibilities
- **Scalability**: Services can scale independently
- **Security**: Prover doesn't need blockchain access

### Why Groth16?
- **Small Proofs**: ~200 bytes
- **Fast Verification**: ~2ms
- **Widely Adopted**: Battle-tested in production

### Why Merkle Proofs for Jurisdictions?
- **Scalability**: O(log n) vs O(n) constraints
- **Flexibility**: Supports unlimited jurisdictions
- **Efficiency**: 98.4% reduction in public inputs (258 → 4)

---

## Troubleshooting

### Prover fails to start
- Check that circuit files exist
- Verify proving/verifying keys are present
- Run `go mod download` to ensure dependencies

### Attester can't connect to blockchain
- Verify `STACKS_NETWORK` is correct
- Check `ATTESTER_REGISTRY` contract address
- Ensure network connectivity to Hiro API

### Proof verification fails
- Ensure prover and attester use same verifying key
- Check that circuit compilation matches
- Verify public inputs format

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

---

## License

[Add your license here]

---

## Support

For issues and questions:
- GitHub Issues: [link]
- Documentation: [link]
- Discord: [link]
