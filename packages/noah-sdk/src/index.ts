/**
 * Noah-v2 SDK
 * Main entry point for protocol integration
 */

export { KYCContract } from './contract';
export { ProofService } from './proof';
export { IdentityService } from './identity';
export { WalletHelper } from './wallet';
export * from './mimc';
export * from './types';

import { KYCContract } from './contract';
import { ProofService } from './proof';
import { IdentityService } from './identity';
import { WalletHelper } from './wallet';
import { computeCommitment } from './mimc';
import { SDKConfig, WalletConfig, RegisterKYCParams, ProofRequest } from './types';

/**
 * Main SDK class
 */
export class NoahSDK {
  public contract: KYCContract;
  public proof: ProofService;
  public identity: IdentityService;
  public wallet: WalletHelper;

  constructor(config: SDKConfig, walletConfig: WalletConfig) {
    this.contract = new KYCContract(config);
    this.proof = new ProofService(config);
    this.identity = new IdentityService(config);
    this.wallet = new WalletHelper(walletConfig);
  }

  /**
   * Helper to compute identity commitment locally (for privacy/blinding)
   */
  public computeCommitment(identityData: string | bigint, nonce: string | bigint, userAddress: string): string {
    return computeCommitment(identityData, nonce, userAddress);
  }

  /**
   * Complete KYC registration flow
   * 1. Submit proof
   * 2. Get attestation
   * 3. Register on-chain
   */
  async registerKYC(
    proofRequest: ProofRequest,
    privateKey: string,
    options?: {
      postConditionMode?: any;
      postConditions?: any[];
      fee?: number;
    }
  ): Promise<string> {
    // Step 1: Submit proof job
    const jobResponse = await this.proof.generateProof(proofRequest);

    if (!jobResponse.success) {
      throw new Error(`Proof submission failed: ${jobResponse.error}`);
    }

    // Step 2: Wait for proof to complete
    const proofResult = await this.proof.waitForProof(jobResponse.job_id);

    // Step 3: Get attestation
    const attestationResponse = await this.proof.requestAttestation({
      commitment: proofResult.commitment,
      public_inputs: proofResult.public_inputs,
      proof: proofResult.proof,
      user_id: proofRequest.user_address, // Use address as ID if not provided
    });

    if (!attestationResponse.success) {
      throw new Error(`Attestation failed: ${attestationResponse.error}`);
    }

    // Step 4: Register on-chain
    const txId = await this.contract.registerKYC({
      commitment: attestationResponse.commitment,
      signature: attestationResponse.signature,
      attesterId: attestationResponse.attester_id,
    }, privateKey, options);

    return txId;
  }
}

// Default export
export default NoahSDK;

