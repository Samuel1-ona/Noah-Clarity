/**
 * Noah-v2 SDK
 * Main entry point for protocol integration
 */

export { KYCContract } from './contract';
export { ProofService } from './proof';
export { IdentityService } from './identity';
export { WalletHelper } from './wallet';
export { BrowserStorage } from './storage';
export { BlindingManager } from './blinding';
export * from './mimc';
export * from './types';
export * from './errors';

import { KYCContract } from './contract';
import { ProofService } from './proof';
import { IdentityService } from './identity';
import { WalletHelper } from './wallet';
import { BrowserStorage } from './storage';
import { BlindingManager } from './blinding';
import { computeCommitment } from './mimc';
import { getAddressFromPrivateKey } from '@stacks/transactions';
import {
  SDKConfig,
  WalletConfig,
  RegisterKYCParams,
  ProofRequest,
  NoahEvent,
  KYCLifecycleState
} from './types';
import { ProverError, AttesterError, ContractError } from './errors';

/**
 * Main SDK class
 */
export class NoahSDK {
  public contract: KYCContract;
  public proof: ProofService;
  public identity: IdentityService;
  public wallet: WalletHelper;

  public blinding: BlindingManager;

  private listeners: Record<string, Function[]> = {};
  private state: KYCLifecycleState = { currentStage: 'idle' };

  constructor(config: SDKConfig, walletConfig: WalletConfig) {
    // Default to BrowserStorage if not explicitly provided
    const storage = config.storage || new BrowserStorage();
    const updatedConfig = { ...config, storage };

    this.contract = new KYCContract(updatedConfig);
    this.proof = new ProofService(updatedConfig);
    this.identity = new IdentityService(updatedConfig);
    this.wallet = new WalletHelper(walletConfig);
    this.blinding = new BlindingManager(storage);
  }

  /**
   * Event Subscription
   */
  public on(event: NoahEvent, callback: Function) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    return () => this.off(event, callback);
  }

  private off(event: NoahEvent, callback: Function) {
    this.listeners[event] = this.listeners[event]?.filter(l => l !== callback) || [];
  }

  private emit(event: NoahEvent, data?: any) {
    this.listeners[event]?.forEach(cb => cb(data));
  }

  /**
   * Get current KYC lifecycle state
   */
  public getState(): KYCLifecycleState {
    return { ...this.state };
  }

  private updateState(patch: Partial<KYCLifecycleState>) {
    this.state = { ...this.state, ...patch };
    this.emit('state-changed', this.state);
  }

  /**
   * Reset current SDK state
   */
  public resetState() {
    this.state = { currentStage: 'idle' };
    this.emit('state-changed', this.state);
  }

  /**
   * Helper to compute identity commitment locally (for privacy/blinding)
   */
  public computeCommitment(identityData: string | bigint, nonce: string | bigint, userAddress: string): string {
    return computeCommitment(identityData, nonce, userAddress);
  }

  /**
   * Complete KYC registration flow with Event tracking
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
    try {
      this.updateState({ currentStage: 'proving', error: undefined });
      this.emit('proof-started', { userAddress: proofRequest.user_address });

      // Step 1: Submit proof job
      const jobResponse = await this.proof.generateProof(proofRequest);
      if (!jobResponse.success) {
        throw new ProverError(`Proof submission failed: ${jobResponse.error}`, jobResponse);
      }
      this.updateState({ jobId: jobResponse.job_id });

      // Step 2: Wait for proof to complete
      const proofResult = await this.proof.waitForProof(jobResponse.job_id);
      this.emit('proof-completed', proofResult);

      // Step 3: Get attestation
      this.updateState({ currentStage: 'attesting' });
      const attestationResponse = await this.proof.requestAttestation({
        commitment: proofResult.commitment,
        public_inputs: proofResult.public_inputs,
        proof: proofResult.proof,
        user_id: proofRequest.user_address,
      });

      if (!attestationResponse.success) {
        throw new AttesterError(`Attestation failed: ${attestationResponse.error}`, attestationResponse);
      }
      this.emit('attestation-received', attestationResponse);

      // Step 4: Register on-chain
      this.updateState({ currentStage: 'registering' });
      const txId = await this.contract.registerKYC({
        commitment: attestationResponse.commitment,
        signature: attestationResponse.signature,
        attesterId: attestationResponse.attester_id,
      }, privateKey, options);

      this.updateState({ txId });
      this.emit('tx-broadcasted', { txId });

      // Final Step: Wait for confirmation
      await this.contract.waitForConfirmation(txId);
      this.updateState({ currentStage: 'completed' });
      this.emit('tx-confirmed', { txId });

      return txId;
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      this.updateState({ currentStage: 'failed', error: message });
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Resume a previously started KYC process from storage
   */
  async resumeKYC(privateKey: string, options?: { fee?: number }): Promise<string | null> {
    const jobId = await this.proof.getPersistedJobId();
    if (!jobId) return null;

    try {
      this.updateState({ currentStage: 'proving', jobId, error: undefined });
      this.emit('proof-started', { jobId, resumed: true });

      // Continue from Step 2: Wait for proof
      const proofResult = await this.proof.waitForProof(jobId);
      this.emit('proof-completed', proofResult);

      // Continue to attestation... (simplified for this version, reusing registerKYC logic)
      this.updateState({ currentStage: 'attesting' });
      const attestationResponse = await this.proof.requestAttestation({
        commitment: proofResult.commitment,
        public_inputs: proofResult.public_inputs,
        proof: proofResult.proof,
        user_id: getAddressFromPrivateKey(privateKey),
      });

      if (!attestationResponse.success) {
        throw new AttesterError('Attestation failed', attestationResponse);
      }
      this.emit('attestation-received', attestationResponse);

      this.updateState({ currentStage: 'registering' });
      const txId = await this.contract.registerKYC({
        commitment: attestationResponse.commitment,
        signature: attestationResponse.signature,
        attesterId: attestationResponse.attester_id,
      }, privateKey, options);

      this.updateState({ txId });
      this.emit('tx-broadcasted', { txId });

      await this.contract.waitForConfirmation(txId);
      this.updateState({ currentStage: 'completed' });
      this.emit('tx-confirmed', { txId });

      return txId;
    } catch (error) {
      this.updateState({ currentStage: 'failed', error: error instanceof Error ? error.message : String(error) });
      this.emit('error', error);
      throw error;
    }
  }
}

// Default export
export default NoahSDK;

