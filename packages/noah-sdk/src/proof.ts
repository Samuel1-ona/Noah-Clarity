import {
  ProofRequest,
  ProofResponse,
  AttestationRequest,
  AttestationResponse,
  SDKConfig,
  ProtocolRequirements,
  JobStatusResponse,
  ProofResult,
  EdDSASignature,
  EdDSAPublicKey,
  StorageInterface
} from './types';
import { CIRCUIT_CONSTANTS } from './constants';
import { ProverError, AttesterError } from './errors';

export class ProofService {
  private config: SDKConfig;
  private storage?: StorageInterface;
  private readonly STORAGE_KEY = 'noah_current_job_id';

  constructor(config: SDKConfig, storage?: StorageInterface) {
    this.config = config;
    this.storage = storage;
  }

  /**
   * Prover service URL helper
   */
  private get proverUrl(): string {
    return this.config.proverServiceUrl || 'http://localhost:8080';
  }

  /**
   * Attester service URL helper
   */
  private get attesterUrl(): string {
    return this.config.attesterServiceUrl || 'http://localhost:8081';
  }

  /**
   * Submit raw ZK proof generation request
   */
  async generateProof(request: ProofRequest): Promise<ProofResponse> {
    const url = `${this.proverUrl}/proof/generate`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        throw new ProverError(`Proof submission failed: ${errorMessage}`);
      }

      const result = await response.json() as ProofResponse;

      // PERSIST: Save the job ID if storage is provided
      if (result.success && result.job_id && this.storage) {
        await this.storage.setItem(this.STORAGE_KEY, result.job_id);
      }

      return result;
    } catch (error) {
      console.error('Error generating proof:', error);
      throw error instanceof ProverError ? error : new ProverError('Failed to submit proof job', error);
    }
  }

  /**
   * Get the persisted job ID from storage (if any)
   */
  async getPersistedJobId(): Promise<string | null> {
    if (!this.storage) return null;
    return await this.storage.getItem(this.STORAGE_KEY);
  }

  /**
   * Clear persisted job
   */
  async clearPersistedJob() {
    if (this.storage) {
      await this.storage.removeItem(this.STORAGE_KEY);
    }
  }

  /**
   * Poll for proof completion
   */
  async waitForProof(jobId: string, interval = 5000, timeout = 300000): Promise<ProofResult> {
    const startTime = Date.now();
    const url = `${this.proverUrl}/proof/status/${jobId}`;

    while (Date.now() - startTime < timeout) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const status = await response.json() as JobStatusResponse;

          if (status.status === 'completed' && status.result) {
            await this.clearPersistedJob(); // Success -> Clear
            return status.result;
          }

          if (status.status === 'failed') {
            await this.clearPersistedJob(); // Failure -> Clear
            throw new ProverError(`Proof generation failed: ${status.error || 'Unknown error'}`);
          }
        } else {
          let errorMessage = response.statusText;
          try {
            const errorData = await response.json();
            errorMessage = (errorData as { error?: string }).error || errorMessage;
          } catch { }
          console.warn(`Failed to fetch job status for ${jobId}: ${errorMessage}. Retrying...`);
        }
      } catch (error) {
        if (error instanceof ProverError) throw error;
        console.error(`Error during job status poll for ${jobId}:`, error);
      }

      await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new ProverError('Proof generation timed out');
  }

  /**
   * Request an attestation signature
   */
  async requestAttestation(request: AttestationRequest): Promise<AttestationResponse> {
    const url = `${this.attesterUrl}/credential/attest`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        let errorMessage = response.statusText;
        try {
          const errorData = await response.json();
          errorMessage = (errorData as { error?: string }).error || errorMessage;
        } catch { }
        throw new AttesterError(`Attestation failed: ${errorMessage}`);
      }

      return await response.json() as AttestationResponse;
    } catch (error) {
      throw error instanceof AttesterError ? error : new AttesterError('Failed to request attestation', error);
    }
  }

  /**
   * Generate a proof matching protocol-specific requirements
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
    const allowed = [...protocolRequirements.allowed_jurisdictions].map(j => j.toString());
    while (allowed.length < CIRCUIT_CONSTANTS.ALLOWED_JURISDICTIONS_COUNT) {
      allowed.push("0");
    }
    const finalAllowed = allowed.slice(0, CIRCUIT_CONSTANTS.ALLOWED_JURISDICTIONS_COUNT);

    const proofRequest: ProofRequest = {
      age: userCredential.age,
      jurisdiction: userCredential.jurisdiction,
      is_accredited: userCredential.is_accredited,
      identity_data: userCredential.identity_data,
      nonce: userCredential.nonce,
      signature: userCredential.signature,
      attester_pub_key: userCredential.attester_pub_key,
      user_address: userCredential.user_address,
      min_age: protocolRequirements.min_age.toString(),
      allowed_jurisdictions: finalAllowed,
      require_accreditation: protocolRequirements.require_accreditation ? '1' : '0',
      commitment: '',
    };

    return await this.generateProof(proofRequest);
  }

  /**
   * Verify that the generated proof matches the expected public inputs
   */
  async verifyPublicInputs(result: ProofResult, expected: { minAge: number, requireAccreditation: boolean }): Promise<boolean> {
    const inputs = result.public_inputs;

    if (inputs[CIRCUIT_CONSTANTS.PUBLIC_INPUTS.MIN_AGE] !== expected.minAge.toString()) return false;

    const expectedAcc = expected.requireAccreditation ? '1' : '0';
    if (inputs[CIRCUIT_CONSTANTS.PUBLIC_INPUTS.REQUIRE_ACCREDITATION] !== expectedAcc) return false;

    return true;
  }
}

