/**
 * Noah-v2 SDK
 * Main entry point for protocol integration
 */

export { KYCContract } from './contract';
export { ProofService } from './proof';
export { IdentityService } from './identity';
export { WalletHelper } from './wallet';
export * from './types';

import { KYCContract } from './contract';
import { ProofService } from './proof';
import { IdentityService } from './identity';
import { WalletHelper } from './wallet';
import { SDKConfig, WalletConfig } from './types';

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
   * Complete KYC registration flow
   * 1. Generate proof
   * 2. Get attestation
   * 3. Register on-chain
   */
  async registerKYC(
    proofRequest: any,
    privateKey: string
  ): Promise<string> {
    // Step 1: Submit proof job
    const jobResponse = await this.proof.generateProof(proofRequest);

    if (!jobResponse.success) {
      throw new Error(`Proof submission failed: ${jobResponse.error}`);
    }

    // Step 2: Wait for proof to complete
    const proofResult = await this.proof.waitForProof(jobResponse.job_id);

    // Step 3: Get attestation (Now includes EdDSA signature and Public Key)
    const attestationResponse = await this.proof.requestAttestation({
      commitment: proofResult.commitment,
      public_inputs: proofResult.public_inputs,
      proof: proofResult.proof,
      user_id: '', // Set from user session
    });

    if (!attestationResponse.success) {
      throw new Error(`Attestation failed: ${attestationResponse.error}`);
    }

    // Step 4: Register on-chain
    // We use the ECDSA signature for the Stacks contract
    const txId = await this.contract.registerKYC({
      commitment: attestationResponse.commitment,
      signature: attestationResponse.signature,
      attesterId: attestationResponse.attester_id,
    }, privateKey);

    return txId;
  }
}

// Default export
export default NoahSDK;

