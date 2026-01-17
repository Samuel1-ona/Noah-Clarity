/**
 * Noah-v2 SDK
 * Main entry point for protocol integration
 */

export { KYCContract } from './contract';
export { ProofService } from './proof';
export { WalletHelper } from './wallet';
export * from './types';

import { KYCContract } from './contract';
import { ProofService } from './proof';
import { WalletHelper } from './wallet';
import { SDKConfig, WalletConfig } from './types';

/**
 * Main SDK class
 */
export class NoahSDK {
  public contract: KYCContract;
  public proof: ProofService;
  public wallet: WalletHelper;

  constructor(config: SDKConfig, walletConfig: WalletConfig) {
    this.contract = new KYCContract(config);
    this.proof = new ProofService(config);
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
    // Step 1: Generate proof
    const proofResponse = await this.proof.generateProof(proofRequest);

    if (!proofResponse.success) {
      throw new Error(`Proof generation failed: ${proofResponse.error}`);
    }

    // Step 2: Get attestation
    const attestationResponse = await this.proof.requestAttestation({
      commitment: proofResponse.commitment,
      public_inputs: proofResponse.public_inputs,
      proof: proofResponse.proof,
      user_id: '', // Set from user session
    });

    if (!attestationResponse.success) {
      throw new Error(`Attestation failed: ${attestationResponse.error}`);
    }

    // Step 3: Register on-chain
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

