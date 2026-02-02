import {
  makeContractCall,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  bufferCV,
  uintCV,
  principalCV,
  cvToJSON,
  callReadOnlyFunction,
} from '@stacks/transactions';
import { StacksNetwork, StacksTestnet, StacksMainnet } from '@stacks/network';
import { SDKConfig, KYCStatus, RegisterKYCParams, AttesterRecord, RevocationStats } from './types';
import { ContractError } from './errors';

/**
 * KYC Registry Contract Interaction Service
 */
export class KYCContract {
  private network: StacksNetwork;
  private config: SDKConfig;

  constructor(config: SDKConfig) {
    this.config = config;
    const networkOptions = config.stacksApiUrl ? { url: config.stacksApiUrl } : undefined;

    if (config.network === 'mainnet') {
      this.network = new StacksMainnet(networkOptions);
    } else {
      this.network = new StacksTestnet(networkOptions);
    }
  }

  /**
   * Helper to parse and wrap contract errors
   */
  private wrapError(error: any): ContractError {
    const message = error.message || String(error);
    if (message.includes('error 403')) return new ContractError('Unauthorized: Not contract owner', error);
    if (message.includes('error 401')) return new ContractError('Unauthorized: Not authorized attester', error);
    if (message.includes('error 100')) return new ContractError('Invalid Input: User already registered', error);
    return new ContractError(`Blockchain error: ${message}`, error);
  }

  /**
   * Register KYC on-chain
   */
  async registerKYC(
    params: RegisterKYCParams,
    privateKey: string,
    options?: {
      postConditionMode?: PostConditionMode;
      postConditions?: any[];
      fee?: number;
    }
  ): Promise<string> {
    const { address: registryAddr, name: registryName } = this.parseContractAddress(this.config.kycRegistryAddress);

    const commitmentBuffer = Buffer.from(params.commitment.replace('0x', ''), 'hex');
    if (commitmentBuffer.length !== 32) {
      throw new ContractError(`Invalid commitment length: expected 32 bytes, got ${commitmentBuffer.length}`);
    }

    const signatureBuffer = Buffer.from(params.signature.replace('0x', ''), 'hex');
    if (signatureBuffer.length !== 64 && signatureBuffer.length !== 65) {
      throw new ContractError(`Invalid signature length: expected 64 or 65 bytes, got ${signatureBuffer.length}`);
    }

    try {
      return await this.broadcastContractCall({
        contractAddress: registryAddr,
        contractName: registryName,
        functionName: 'register-kyc',
        functionArgs: [
          bufferCV(commitmentBuffer),
          bufferCV(signatureBuffer),
          uintCV(params.attesterId),
        ],
        privateKey,
        fee: options?.fee,
      });
    } catch (error) {
      throw this.wrapError(error);
    }
  }

  /**
   * Check if a user has a KYC record
   */
  async hasKYC(userPrincipal: string): Promise<boolean> {
    const { address, name } = this.parseContractAddress(this.config.kycRegistryAddress);
    try {
      const result = await callReadOnlyFunction({
        contractAddress: address,
        contractName: name,
        functionName: 'has-kyc?',
        functionArgs: [principalCV(userPrincipal)],
        network: this.network,
        senderAddress: address,
      });
      const json = cvToJSON(result);
      return json.value?.value === true || json.value === true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get KYC details for a user
   */
  async getKYC(userPrincipal: string): Promise<KYCStatus | null> {
    const { address, name } = this.parseContractAddress(this.config.kycRegistryAddress);
    try {
      const result = await callReadOnlyFunction({
        contractAddress: address,
        contractName: name,
        functionName: 'get-kyc',
        functionArgs: [principalCV(userPrincipal)],
        network: this.network,
        senderAddress: address,
      });

      const json = cvToJSON(result);
      if (json.success === true && json.value?.value?.value) {
        const record = json.value.value.value;
        const status: KYCStatus = {
          hasKYC: true,
          commitment: record.commitment?.value,
          attesterId: record['attester-id']?.value,
          registeredAt: record['registered-at']?.value,
        };

        if (record['previous-commitment']?.value) {
          status.previousCommitment = record['previous-commitment'].value;
        }
        if (record['previous-registered-at']?.value !== undefined) {
          status.previousRegisteredAt = record['previous-registered-at'].value;
        }
        return status;
      }
      return null;
    } catch (error) {
      console.error('Error getting KYC details:', error);
      return null;
    }
  }

  /**
   * Check if KYC is valid (exists and not revoked)
   */
  async isKYCValid(userPrincipal: string): Promise<boolean> {
    const details = await this.getKYC(userPrincipal);
    if (!details || !details.commitment) return false;

    // Check revocation
    const isRevoked = await this.isCommitmentRevoked(details.commitment);
    return !isRevoked;
  }

  /**
   * Revoke KYC (Admin or issuing attester)
   */
  async revokeKYC(userPrincipal: string, privateKey: string): Promise<string> {
    const { address, name } = this.parseContractAddress(this.config.kycRegistryAddress);
    try {
      return await this.broadcastContractCall({
        contractAddress: address,
        contractName: name,
        functionName: 'revoke-kyc',
        functionArgs: [principalCV(userPrincipal)],
        privateKey,
      });
    } catch (error) {
      throw this.wrapError(error);
    }
  }

  /**
   * Get contract owner
   */
  async getContractOwner(registry: 'kyc' | 'attester' | 'revocation'): Promise<string> {
    const registryAddr = registry === 'kyc' ? this.config.kycRegistryAddress :
      registry === 'attester' ? this.config.attesterRegistryAddress :
        this.config.revocationRegistryAddress!;
    const { address, name } = this.parseContractAddress(registryAddr);

    const result = await callReadOnlyFunction({
      contractAddress: address,
      contractName: name,
      functionName: 'get-contract-owner',
      functionArgs: [],
      network: this.network,
      senderAddress: address,
    });

    const json = cvToJSON(result);
    return (json.value?.value || json.value) as string;
  }

  /**
   * Transfer ownership
   */
  async transferOwnership(registry: 'kyc' | 'attester', newOwner: string, privateKey: string): Promise<string> {
    const registryAddr = registry === 'kyc' ? this.config.kycRegistryAddress : this.config.attesterRegistryAddress;
    const { address, name } = this.parseContractAddress(registryAddr);

    try {
      return await this.broadcastContractCall({
        contractAddress: address,
        contractName: name,
        functionName: 'transfer-ownership',
        functionArgs: [principalCV(newOwner)],
        privateKey,
      });
    } catch (error) {
      throw this.wrapError(error);
    }
  }

  /**
   * Add attester
   */
  async addAttester(params: { pubkey: string, id: number, address: string }, privateKey: string): Promise<string> {
    const { address, name } = this.parseContractAddress(this.config.attesterRegistryAddress);
    const pubkeyBuffer = Buffer.from(params.pubkey.replace('0x', ''), 'hex');

    try {
      return await this.broadcastContractCall({
        contractAddress: address,
        contractName: name,
        functionName: 'add-attester',
        functionArgs: [
          bufferCV(pubkeyBuffer),
          uintCV(params.id),
          principalCV(params.address),
        ],
        privateKey,
      });
    } catch (error) {
      throw this.wrapError(error);
    }
  }

  /**
   * Deactivate attester
   */
  async deactivateAttester(id: number, privateKey: string): Promise<string> {
    const { address, name } = this.parseContractAddress(this.config.attesterRegistryAddress);
    try {
      return await this.broadcastContractCall({
        contractAddress: address,
        contractName: name,
        functionName: 'deactivate-attester',
        functionArgs: [uintCV(id)],
        privateKey,
      });
    } catch (error) {
      throw this.wrapError(error);
    }
  }

  /**
   * Get attester details
   */
  async getAttester(id: number): Promise<AttesterRecord | null> {
    const { address, name } = this.parseContractAddress(this.config.attesterRegistryAddress);
    try {
      const pubkeyResult = await callReadOnlyFunction({
        contractAddress: address, contractName: name, functionName: 'get-attester-pubkey',
        functionArgs: [uintCV(id)], network: this.network, senderAddress: address,
      });
      const addrResult = await callReadOnlyFunction({
        contractAddress: address, contractName: name, functionName: 'get-attester-address',
        functionArgs: [uintCV(id)], network: this.network, senderAddress: address,
      });
      const activeResult = await callReadOnlyFunction({
        contractAddress: address, contractName: name, functionName: 'is-attester-active?',
        functionArgs: [uintCV(id)], network: this.network, senderAddress: address,
      });

      const pubkeyJson = cvToJSON(pubkeyResult);
      const addrJson = cvToJSON(addrResult);
      const activeJson = cvToJSON(activeResult);

      if (!pubkeyJson.success) return null;

      return {
        id,
        pubkey: pubkeyJson.value?.value || pubkeyJson.value,
        address: addrJson.value?.value || addrJson.value,
        active: activeJson.value?.value === true || activeJson.value === true,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Get all attester IDs
   */
  async getAllAttesters(): Promise<number[]> {
    const { address, name } = this.parseContractAddress(this.config.attesterRegistryAddress);
    try {
      const result = await callReadOnlyFunction({
        contractAddress: address,
        contractName: name,
        functionName: 'get-attesters',
        functionArgs: [],
        network: this.network,
        senderAddress: address,
      });
      const json = cvToJSON(result);
      if (json.success && json.value?.value) {
        return (json.value.value as any[]).map((item: any) => parseInt(item.value));
      }
      return [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Update revocation root (Admin only)
   */
  async updateRevocationRoot(newRoot: string, privateKey: string): Promise<string> {
    if (!this.config.revocationRegistryAddress) throw new Error('Revocation registry not configured');
    const { address, name } = this.parseContractAddress(this.config.revocationRegistryAddress);
    const rootBuffer = Buffer.from(newRoot.replace('0x', ''), 'hex');

    try {
      return await this.broadcastContractCall({
        contractAddress: address,
        contractName: name,
        functionName: 'update-revocation-root',
        functionArgs: [bufferCV(rootBuffer)],
        privateKey,
      });
    } catch (error) {
      throw this.wrapError(error);
    }
  }

  /**
   * Get revocation root height
   */
  async getRevocationRootHeight(): Promise<number> {
    if (!this.config.revocationRegistryAddress) return 0;
    const { address, name } = this.parseContractAddress(this.config.revocationRegistryAddress);
    try {
      const result = await callReadOnlyFunction({
        contractAddress: address,
        contractName: name,
        functionName: 'get-revocation-root-height',
        functionArgs: [],
        network: this.network,
        senderAddress: address,
      });
      const json = cvToJSON(result);
      return parseInt(json.value?.value || '0');
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get revocation root
   */
  async getRevocationRoot(): Promise<string | null> {
    if (!this.config.revocationRegistryAddress) return null;
    const { address, name } = this.parseContractAddress(this.config.revocationRegistryAddress);
    try {
      const result = await callReadOnlyFunction({
        contractAddress: address,
        contractName: name,
        functionName: 'get-revocation-root',
        functionArgs: [],
        network: this.network,
        senderAddress: address,
      });
      const json = cvToJSON(result);
      return json.value?.value || json.value;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check revocation status via attester service
   */
  async isCommitmentRevoked(commitment: string): Promise<boolean> {
    if (!this.config.attesterServiceUrl) return false;
    try {
      const url = `${this.config.attesterServiceUrl}/revocation/check?commitment=${encodeURIComponent(commitment)}`;
      const response = await fetch(url);
      if (!response.ok) return false;
      const data = await response.json() as { revoked?: boolean };
      return data.revoked === true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if revoked on-chain (placeholder)
   */
  async isCommitmentRevokedOnChain(commitment: string): Promise<boolean> {
    if (!this.config.revocationRegistryAddress) return false;
    const { address, name } = this.parseContractAddress(this.config.revocationRegistryAddress);
    const commitmentBuffer = Buffer.from(commitment.replace('0x', ''), 'hex');

    try {
      const result = await callReadOnlyFunction({
        contractAddress: address,
        contractName: name,
        functionName: 'is-revoked?',
        functionArgs: [bufferCV(commitmentBuffer)],
        network: this.network,
        senderAddress: address,
      });
      const json = cvToJSON(result);
      return json.value?.value === true || json.value === true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Broadcast contract call helper
   */
  private async broadcastContractCall(params: {
    contractAddress: string,
    contractName: string,
    functionName: string,
    functionArgs: any[],
    privateKey: string,
    fee?: number
  }): Promise<string> {
    const txOptions = {
      contractAddress: params.contractAddress,
      contractName: params.contractName,
      functionName: params.functionName,
      functionArgs: params.functionArgs,
      senderKey: params.privateKey,
      fee: params.fee || 5000,
      network: this.network,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
    };

    const transaction = await makeContractCall(txOptions);
    const response = await broadcastTransaction(transaction, this.network);

    if ('error' in response && response.error) {
      throw new Error(`Broadcast failed: ${response.error}`);
    }

    return response.txid;
  }

  /**
   * Wait for confirmation
   */
  async waitForConfirmation(txId: string, interval = 10000, timeout = 600000): Promise<any> {
    const startTime = Date.now();
    const cleanTxId = txId.startsWith('0x') ? txId : `0x${txId}`;

    while (Date.now() - startTime < timeout) {
      try {
        const response = await fetch(`${this.network.coreApiUrl}/extended/v1/tx/${cleanTxId}`);
        if (response.ok) {
          const data = await response.json() as any;
          if (data.tx_status === 'success') return data;
          if (data.tx_status === 'abort_by_response' || data.tx_status === 'abort_by_post_condition') {
            throw new Error(`Transaction aborted: ${data.error || 'Unknown error'}`);
          }
        }
      } catch (error: any) {
        if (error.message?.includes('Transaction aborted')) throw error;
      }
      await new Promise(r => setTimeout(r, interval));
    }
    throw new Error('Transaction confirmation timed out');
  }

  /**
   * Parse contract address
   */
  private parseContractAddress(contractId: string): { address: string; name: string } {
    const parts = contractId.split('.');
    if (parts.length !== 2) throw new Error(`Invalid contract address: ${contractId}`);
    return { address: parts[0], name: parts[1] };
  }
}
