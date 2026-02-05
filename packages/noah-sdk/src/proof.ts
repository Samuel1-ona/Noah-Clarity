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
import { mimcHash } from './mimc';
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

    let retryCount = 0;
    const maxRetries = 10;

    while (Date.now() - startTime < timeout) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const status = await response.json() as JobStatusResponse;

          if (status.status === 'completed' && status.result) {
            await this.clearPersistedJob();
            return status.result;
          }

          if (status.status === 'failed') {
            await this.clearPersistedJob();
            throw new ProverError(`Proof generation failed: ${status.error || 'Unknown error'}`);
          }

          retryCount = 0; // Reset on successful status fetch
        } else {
          retryCount++;
          if (retryCount > maxRetries) {
            throw new ProverError(`Max retries reached while fetching job status: ${response.statusText}`);
          }
          console.warn(`Attempt ${retryCount}: Failed to fetch job status for ${jobId}. Retrying...`);
        }
      } catch (error) {
        if (error instanceof ProverError) throw error;
        retryCount++;
        if (retryCount > maxRetries) {
          throw new ProverError('Max retries reached during job status polling', error);
        }
        console.error(`Attempt ${retryCount}: Error during job status poll:`, error);
      }

      const backoff = Math.min(interval * Math.pow(1.5, retryCount), 30000);
      if (retryCount > 0) {
        console.warn(`Waiting ${Math.round(backoff / 1000)}s before retry ${retryCount}...`);
      }
      await new Promise(resolve => setTimeout(resolve, backoff));
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
      commitment: string; // From attester
    },
    protocolRequirements: ProtocolRequirements
  ): Promise<ProofResponse> {

    // --- Merkle Proof Construction (Simplified for Single User/Permissive Mode) ---
    // The circuit expects:
    // - mp.Path[0] = Jurisdiction (actual value)
    // - mp.Path[1:] = Siblings
    // - Root = reconstructed from Path[0] and Siblings using bit decomposition from Helper

    const depth = 20;
    const zeros: bigint[] = [];

    // Precompute zero hashes for the tree
    // zeros[0] is the sibling of the leaf (level 0)
    // Level 0 is at index 0 in gnark-crypto merkle logic 
    zeros.push(mimcHash([0n]));

    for (let i = 1; i < depth; i++) {
      zeros.push(mimcHash([zeros[i - 1], zeros[i - 1]]));
    }

    const path: string[] = [];
    const helper: string[] = []; // bits (0 for left, 1 for right)

    // Compute original root for public input (sanity check)
    // Circuit: sum = Hash(Path[0])
    let currentHash = mimcHash([BigInt(userCredential.jurisdiction)]);

    for (let i = 0; i < depth; i++) {
      // In this permissive tree, the leaf is at index 0 (all helper bits are 0)
      // So every sibling is a zero hash at that level.
      path.push(zeros[i].toString());
      helper.push("0");

      // nextLevel = Hash(current, sibling)
      currentHash = mimcHash([currentHash, zeros[i]]);
    }

    const jurisdictionRoot = currentHash.toString();

    // ---------------------------------------------------------------------------

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
      require_accreditation: protocolRequirements.require_accreditation ? '1' : '0',
      commitment: userCredential.commitment,
      jurisdiction_root: jurisdictionRoot,
      merkle_path: path,
      merkle_helper: helper,
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

