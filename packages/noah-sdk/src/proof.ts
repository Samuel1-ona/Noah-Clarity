/**
 * Proof generation and verification utilities
 */

import { ProofRequest, ProofResponse, AttestationRequest, AttestationResponse, SDKConfig } from './types';

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
   * Verify a proof (off-chain verification)
   * Note: This is a placeholder - actual verification would use the verification key
   * @param proof Serialized proof
   * @param publicInputs Public inputs
   * @returns true if proof is valid
   */
  async verifyProof(proof: string, publicInputs: string[]): Promise<boolean> {
    // In production, this would:
    // 1. Deserialize the proof
    // 2. Load the verification key
    // 3. Verify using gnark or similar library
    // For now, return true as a placeholder
    return true;
  }
}

