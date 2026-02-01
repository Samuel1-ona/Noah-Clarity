/**
 * Proof generation and verification utilities
 */

import { ProofRequest, ProofResponse, AttestationRequest, AttestationResponse, SDKConfig, ProtocolRequirements, JobStatusResponse, ProofResult, EdDSASignature, EdDSAPublicKey } from './types';
import { CIRCUIT_CONSTANTS } from './constants';

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
      throw new Error(`Proof submission failed: ${errorMessage}`);
    }

    const data = await response.json();
    return data as ProofResponse;
  }

  /**
   * Get the status of a proof generation job
   * @param jobId Job ID
   */
  async getJobStatus(jobId: string): Promise<JobStatusResponse> {
    const response = await fetch(`${this.proverServiceUrl}/proof/status/${jobId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch job status: ${response.statusText}`);
    }
    const data = await response.json();
    return data as JobStatusResponse;
  }

  /**
   * Wait for proof generation to complete
   * @param jobId Job ID
   * @param interval Polling interval in ms (default 2000)
   * @param timeout Max timeout in ms (default 60000)
   */
  async waitForProof(jobId: string, interval = 2000, timeout = 60000): Promise<ProofResult> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const status = await this.getJobStatus(jobId);
      if (status.status === 'completed' && status.result) {
        return status.result;
      }
      if (status.status === 'failed') {
        throw new Error(`Proof generation failed: ${status.error}`);
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw new Error('Proof generation timed out');
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
      signature: EdDSASignature;
      attester_pub_key: EdDSAPublicKey;
      user_address: string;
    },
    protocolRequirements: ProtocolRequirements
  ): Promise<ProofResponse> {
    // PAD JURISDICTIONS: Ensure exactly 10 slots are filled for the circuit
    const allowed = [...protocolRequirements.allowed_jurisdictions].map(j => j.toString());
    while (allowed.length < CIRCUIT_CONSTANTS.ALLOWED_JURISDICTIONS_COUNT) {
      allowed.push("0");
    }
    const finalAllowed = allowed.slice(0, CIRCUIT_CONSTANTS.ALLOWED_JURISDICTIONS_COUNT);

    // Construct ProofRequest with protocol requirements as public inputs
    const proofRequest: ProofRequest = {
      // Private inputs
      age: userCredential.age,
      jurisdiction: userCredential.jurisdiction,
      is_accredited: userCredential.is_accredited,
      identity_data: userCredential.identity_data,
      nonce: userCredential.nonce,
      signature: userCredential.signature,
      attester_pub_key: userCredential.attester_pub_key,
      user_address: userCredential.user_address,

      // Public inputs
      min_age: protocolRequirements.min_age.toString(),
      allowed_jurisdictions: finalAllowed,
      require_accreditation: protocolRequirements.require_accreditation ? '1' : '0',
      commitment: '', // Computed by prover service
    };

    // Submit proof job
    return await this.generateProof(proofRequest);
  }

  /**
   * Verify that the generated proof matches the expected public inputs
   */
  async verifyPublicInputs(result: ProofResult, expected: { minAge: number, requireAccreditation: boolean }): Promise<boolean> {
    const inputs = result.public_inputs;

    // Check MinAge
    if (inputs[CIRCUIT_CONSTANTS.PUBLIC_INPUTS.MIN_AGE] !== expected.minAge.toString()) {
      return false;
    }

    // Check RequireAccreditation
    const expectedAcc = expected.requireAccreditation ? '1' : '0';
    if (inputs[CIRCUIT_CONSTANTS.PUBLIC_INPUTS.REQUIRE_ACCREDITATION] !== expectedAcc) {
      return false;
    }

    return true;
  }
}

