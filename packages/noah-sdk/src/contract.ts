/**
 * Clarity contract interaction helpers
 */

import {
  makeContractCall,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  bufferCV,
  uintCV,
  principalCV,
  getAddressFromPrivateKey,
  cvToJSON,
  callReadOnlyFunction,
} from '@stacks/transactions';
import { StacksNetwork, StacksTestnet, StacksMainnet } from '@stacks/network';
import { SDKConfig, KYCStatus, RegisterKYCParams } from './types';

export class KYCContract {
  private config: SDKConfig;
  private network: StacksNetwork;

  constructor(config: SDKConfig) {
    this.config = config;
    this.network = this.getNetwork();
  }

  private getNetwork(): StacksNetwork {
    switch (this.config.network) {
      case 'mainnet':
        return new StacksMainnet();
      case 'testnet':
        return new StacksTestnet();
      default:
        return new StacksTestnet();
    }
  }

  /**
   * Register KYC on-chain
   * @param params Registration parameters
   * @param privateKey Private key for signing transaction
   * @returns Transaction ID
   */
  async registerKYC(
    params: RegisterKYCParams,
    privateKey: string
  ): Promise<string> {
    const senderAddress = getAddressFromPrivateKey(privateKey, this.network.version);

    const { address, name } = this.parseContractAddress(this.config.kycRegistryAddress);

    const functionArgs = [
      bufferCV(Buffer.from(params.commitment.replace('0x', ''), 'hex')),
      bufferCV(Buffer.from(params.signature.replace('0x', ''), 'hex')),
      uintCV(params.attesterId),
    ];

    const txOptions = {
      contractAddress: address,
      contractName: name,
      functionName: 'register-kyc',
      functionArgs,
      senderKey: privateKey,
      fee: 1000,
      network: this.network,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
    };

    try {
      const transaction = await makeContractCall(txOptions);
      const broadcastResponse = await broadcastTransaction(transaction, this.network);
      return broadcastResponse.txid;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Transaction failed: ${error.message}`);
      }
      throw new Error(`Transaction failed: ${String(error)}`);
    }
  }

  /**
   * Check if a user has valid KYC
   * @param userPrincipal User's Stacks principal
   * @returns KYC status
   */
  async hasKYC(userPrincipal: string): Promise<KYCStatus> {
    const { address, name } = this.parseContractAddress(this.config.kycRegistryAddress);

    try {
      const result = await callReadOnlyFunction({
        contractAddress: address,
        contractName: name,
        functionName: 'has-kyc?',
        functionArgs: [principalCV(userPrincipal)],
        network: this.network,
        senderAddress: address, // Use contract address as sender for read-only calls
      });

      const jsonResult = cvToJSON(result);
      
      // Result is (ok bool), so check if it's ok and the value is true
      if (jsonResult.type === 'responseOk') {
        const hasKYC = jsonResult.value.value === true;
        return { hasKYC };
      } else {
        return { hasKYC: false };
      }
    } catch (error) {
      console.error('Error checking KYC status:', error);
      return { hasKYC: false };
    }
  }

  /**
   * Check if KYC is valid
   * Since KYC records don't expire, this is equivalent to hasKYC
   * @param userPrincipal User's Stacks principal
   * @returns true if KYC is valid
   */
  async isKYCValid(userPrincipal: string): Promise<boolean> {
    const status = await this.hasKYC(userPrincipal);
    return status.hasKYC;
  }

  /**
   * Get KYC details for a user
   * @param userPrincipal User's Stacks principal
   * @returns KYC details or null
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

      const jsonResult = cvToJSON(result);
      
      // Result is (ok (some kyc-record)) or (ok none)
      if (jsonResult.type === 'responseOk' && jsonResult.value.type === 'optionalSome') {
        const record = jsonResult.value.value.value;
        return {
          hasKYC: true,
          commitment: record.commitment?.value,
          attesterId: record['attester-id']?.value,
          registeredAt: record['registered-at']?.value,
        };
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error getting KYC details:', error);
      return null;
    }
  }

  /**
   * Parse contract address from contract identifier (e.g., "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.kyc-registry")
   */
  private parseContractAddress(contractId: string): { address: string; name: string } {
    const parts = contractId.split('.');
    if (parts.length !== 2) {
      throw new Error(`Invalid contract address format: ${contractId}. Expected format: ADDRESS.contract-name`);
    }
    return {
      address: parts[0],
      name: parts[1],
    };
  }
}

