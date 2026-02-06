# Noah-v2 Backend: The Infrastructure of Trust

Welcome to the engine room of Noah. This directory contains the two primary off-chain components that make our privacy-preserving KYC possible: the **Attester** and the **Prover**.

Think of the Attester as the "Eyes and Ears" that verify real-world identities, while the Prover is the "Wall of Privacy" that translates those identities into zero-knowledge proofs.

---

##  The Attester: Identity Verification

The Attester is the bridge between the physical world and the digital ZK world. Its job is to verify that a user is a real person without ever storing their sensitive data longer than necessary.

### How it works
1. **OCR & Document Validation**: Using the `OCRService`, it extracts data from passports and IDs. It checks for validity, expiry, and consistency across documents.
2. **Sybil Protection**: To prevent one person from registering multiple addresses, it generates a unique "Identity Fingerprint" (a hash of the document details). If the same document is used with a different address, the Attester blocks it unless the previous registration is revoked.
3. **The Commitment Generator**: This is the "Secret Sauce." Instead of handing over your passport number to a smart contract, the Attester computes a **MiMC Commitment**:
   `Commitment = MiMC(IdentityData + Nonce + UserAddress)`
   This commitment is unique to the user and their wallet, but reveals nothing about the identity itself.
4. **Attestation & Signing**: Once verified, the Attester signs the commitment using two keys:
   - **EdDSA (BN254)**: Used by the Prover inside the ZK circuit.
   - **ECDSA (secp256k1)**: Used by the Stacks blockchain to verify the attester's authenticity on-chain.

---

##  The Prover: Zero-Knowledge Generation

The Prover is where the magic happens. It takes the credential issued by the Attester and generates a **Groth16 ZK-Proof** that says: *"I have a valid credential that meets these specific requirements, but I won't tell you who I am."*

### The Core Constraints (What the Circuit Actually Checks)
The Prover runs a series of mathematical checks (constraints) that must all pass for a proof to be valid:

1.  **Identity Integrity (The Anchor)**: 
    - The circuit recomputes the MiMC hash from the user's private data and the public wallet address.
    - It asserts that this recomputed hash **must match** the Commitment signed by the Attester. This prevents anyone from "stealing" a credential or using it with the wrong wallet.
2.  **Attester Authenticity**:
    - The circuit verifies the **EdDSA Signature** provided by the Attester.
    - It ensures the signature was created by a known, trusted Attester's public key.
3.  **Age Verification**:
    - `Assert(User.Age >= Requirement.MinAge)`
    - This is a simple range check, but it's done entirely within the ZK-envelope. The contract only sees "True," never the actual age.
4.  **Jurisdiction Check (Merkle Optimized)**:
    - Instead of a slow linear scan, we use a **Merkle Tree of Jurisdictions**.
    - The circuit receives a Merkle Proof and verifies that the user's `JurisdictionID` is a valid leaf in the `JurisdictionRoot` provided by the protocol. This supports thousands of countries with zero overhead.
5.  **Accreditation Logic**:
    - If a protocol requires accreditation, the circuit enforces `IsAccredited == 1`. 
    - If the protocol doesn't require it, this check is skipped.

---

##  The Workflow: A User's Journey

1.  **Step 1 (The Check-In)**: The user uploads a document to the **Attester**.
2.  **Step 2 (The Voucher)**: The **Attester** verifies the doc and hands the user a **Signed Credential** (the "Secret Handshake").
3.  **Step 3 (The Proof)**: The user gives that credential to the **Prover**.
4.  **Step 4 (The Result)**: The **Prover** huffs and puffs for a few seconds and returns a **ZK-Proof**.
5.  **Step 5 (The Chain)**: The user submits that ZK-Proof to the **Smart Contract**. The contract verifies the proof is valid and grants access—without ever knowing who the user is.

---

##  Technical Foundation

Under the hood, we use some state-of-the-art tech to make this possible:
- **Language**: Pure Go for speed and security.
- **Cryptography**: BN254 curve (for blockchain compatibility).
- **Proving System**: Groth16 (for small, fast-to-verify proofs).
- **Hashing**: MiMC (a "ZK-friendly" hash that makes our circuits much smaller and faster).
