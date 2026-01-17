/**
 * Proof generation and verification utilities
 */

import { ProofRequest, ProofResponse, AttestationRequest, AttestationResponse, SDKConfig, ProtocolRequirements } from './types';

export class ProofService {
  private proverServiceUrl: string;
  private attesterServiceUrl: string;

  constructor(config: SDKConfig) {
    this.proverServiceUrl = config.proverServiceUrl || 'http://localhost:8080';
    this.attesterServiceUrl = config.attesterServiceUrl || 'http://localhost:8081';
  }

  /**
   * Generate a ZK proof
   * @param request Proof generation request
   * @returns Proof response
   */
  async generateProof(request: ProofRequest): Promise<ProofResponse> {
    const response = await fetch(`${this.proverServiceUrl}/proof/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      let errorMessage = response.statusText;
      try {
        const errorData = await response.json();
        errorMessage = (errorData as { error?: string }).error || errorMessage;
      } catch {
        // If response is not JSON, use statusText
      }
      throw new Error(`Proof generation failed: ${errorMessage}`);
    }

    const data = await response.json();
    return data as ProofResponse;
  }

  /**
   * Request an attestation signature from the attester
   * @param request Attestation request
   * @returns Attestation response
   */
  async requestAttestation(request: AttestationRequest): Promise<AttestationResponse> {
    const response = await fetch(`${this.attesterServiceUrl}/credential/attest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      let errorMessage = response.statusText;
      try {
        const errorData = await response.json();
        errorMessage = (errorData as { error?: string }).error || errorMessage;
      } catch {
        // If response is not JSON, use statusText
      }
      throw new Error(`Attestation failed: ${errorMessage}`);
    }

    const data = await response.json();
    return data as AttestationResponse;
  }

  /**
   * Generate a proof matching protocol-specific requirements
   * 
   * Takes user credential data and protocol requirements, then constructs
   * a ProofRequest with protocol requirements as public inputs.
   * 
   * @param userCredential User's credential data (private inputs)
   * @param protocolRequirements Protocol's KYC requirements (public inputs)
   * @returns Proof response with proof and public inputs
   */
  async generateProofForProtocol(
    userCredential: {
      age: string;
      jurisdiction: string;
      is_accredited: string;
      identity_data: string;
      nonce: string;
    },
    protocolRequirements: ProtocolRequirements
  ): Promise<ProofResponse> {
    // Construct ProofRequest with protocol requirements as public inputs
    const proofRequest: ProofRequest = {
      // Private inputs (user's actual credential data)
      age: userCredential.age,
      jurisdiction: userCredential.jurisdiction,
      is_accredited: userCredential.is_accredited,
      identity_data: userCredential.identity_data,
      nonce: userCredential.nonce,
      
      // Public inputs (protocol requirements)
      min_age: protocolRequirements.min_age.toString(),
      allowed_jurisdictions: protocolRequirements.allowed_jurisdictions.map(j => j.toString()),
      require_accreditation: protocolRequirements.require_accreditation ? '1' : '0',
      commitment: '', // Will be computed by prover service
    };

    // Generate proof using existing method
    return await this.generateProof(proofRequest);
  }
}

