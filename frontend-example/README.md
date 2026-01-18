# Noah-v2 Frontend Example

A beautiful, user-friendly frontend example demonstrating the Noah-v2 privacy-preserving KYC system with protocol-specific requirements.

## Features

- **Material UI Design**: Modern, clean interface using Material-UI components
- **Step-by-Step KYC Flow**: Guided user experience through the KYC registration process
- **Protocol Requirements**: Demonstrates how protocols define their KYC requirements
- **Zero-Knowledge Proofs**: Privacy-preserving verification without exposing personal data
- **Wallet Integration**: Seamless Stacks wallet connection and transaction handling

## User Flow

### Initial KYC Registration (One-Time)

1. **Connect Wallet**: User connects their Stacks wallet
2. **Enter Information**: User provides their age, jurisdiction, and accreditation status
3. **Generate Privacy Proof**: System generates a zero-knowledge proof matching protocol requirements
4. **Get Verification**: KYC provider verifies the proof and signs the credential
5. **Register On-Chain**: User's verified KYC credential is registered on the Stacks blockchain
6. **Complete**: User now has KYC registered and can access protocols

### Using Protocol with Requirements (Each Protocol)

1. **View Protocol Requirements**: User sees what the protocol requires (age, jurisdictions, accreditation)
2. **Generate Matching Proof**: System generates proof showing user meets protocol requirements
3. **Get Attestation**: Automatic verification from KYC provider
4. **Register/Update KYC**: On-chain registration with commitment and signature
5. **Protocol Checks KYC**: Protocol verifies user's KYC status before granting access

## Getting Started

### Prerequisites

- Node.js 20.19+ or 22.12+
- npm or yarn
- Stacks wallet (Hiro Wallet or similar)

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env` file in the root directory:

```env
VITE_KYC_REGISTRY=STVAH96MR73TP2FZG2W4X220MEB4NEMJHPMVYQNS.KYC-registry
VITE_ATTESTER_REGISTRY=STVAH96MR73TP2FZG2W4X220MEB4NEMJHPMVYQNS.attester-registry
VITE_PROVER_URL=http://localhost:8080
VITE_ATTESTER_URL=http://localhost:8081
VITE_NETWORK=testnet
```

### Running the Application

```bash
# Start the development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
src/
├── components/
│   ├── KYCRegistration.tsx    # Step-by-step KYC registration flow
│   └── Vault.tsx               # Protocol example (vault with KYC requirement)
├── config/
│   └── protocolRequirements.ts # Protocol requirements configuration
├── lib/
│   ├── kyc.ts                  # KYC SDK integration
│   ├── proof.ts                # Proof generation client
│   └── stacks.ts               # Stacks wallet integration
└── App.tsx                     # Main application component
```

## Protocol Requirements

Protocols define their KYC requirements in `src/config/protocolRequirements.ts`:

```typescript
export const VAULT_PROTOCOL_REQUIREMENTS: ProtocolRequirements = {
  min_age: 18,
  allowed_jurisdictions: [1, 2, 3], // US, EU, UK
  require_accreditation: false,
};
```

## SDK Usage

The frontend uses the `noah-clarity` SDK (v0.3.0+) which provides:

- `NoahSDK`: Main SDK class
- `generateProofForProtocol()`: Generate proofs matching protocol requirements
- `registerKYC()`: Complete KYC registration flow
- `isKYCValid()`: Check user's KYC status

## Key Features

### Privacy-Preserving

- Zero-knowledge proofs protect user privacy
- Personal data never leaves the user's device
- Only verification results are shared

### Protocol-Specific

- Each protocol can define its own requirements
- Users generate proofs matching specific protocol needs
- Flexible and extensible system

### User-Friendly

- Clear step-by-step guidance
- Material UI for beautiful, accessible interface
- Human-friendly messaging and explanations

## Development

### Adding New Protocols

1. Add protocol requirements to `src/config/protocolRequirements.ts`
2. Create a new component or extend existing ones
3. Update navigation if needed

### Customizing Requirements

Protocol requirements are defined off-chain (in configuration files or APIs). This allows protocols to:
- Set minimum age requirements
- Specify allowed jurisdictions
- Require accreditation status
- Update requirements without deploying new contracts

## License

See the main project LICENSE file.
