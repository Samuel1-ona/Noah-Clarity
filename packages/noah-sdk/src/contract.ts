/**
 * Clarity contract interaction helpers
 */

import {
  makeContractCall,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  ClarityValue,
  bufferCV,
  uintCV,
  principalCV,
  contractPrincipalCV,
  ResponseError,
  getAddressFromPrivateKey,
  StacksNetwork,
  StacksTestnet,
  StacksMainnet,
} from '@stacks/transactions';
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

    const functionArgs = [
      bufferCV(Buffer.from(params.commitment.replace('0x', ''), 'hex')),
      bufferCV(Buffer.from(params.signature.replace('0x', ''), 'hex')),
      uintCV(params.attesterId),
      uintCV(params.expiry),
    ];

    const txOptions = {
      contractAddress: this.getContractAddress(this.config.kycRegistryAddress),
      contractName: 'kyc-registry',
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
      if (error instanceof ResponseError) {
        throw new Error(`Transaction failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Check if a user has valid KYC
   * @param userPrincipal User's Stacks principal
   * @returns KYC status
   */
  async hasKYC(userPrincipal: string): Promise<KYCStatus> {
    // This would use a read-only function call
    // For now, return a placeholder
    // In production, use @stacks/network to call read-only functions
    return {
      hasKYC: false,
    };
  }

  /**
   * Check if KYC is valid (not expired)
   * @param userPrincipal User's Stacks principal
   * @returns true if KYC is valid
   */
  async isKYCValid(userPrincipal: string): Promise<boolean> {
    const status = await this.hasKYC(userPrincipal);
    if (!status.hasKYC || !status.expiry) {
      return false;
    }

    // Check if expiry is in the future
    // In production, compare with current block height
    return status.expiry > Date.now() / 1000;
  }

  /**
   * Get KYC details for a user
   * @param userPrincipal User's Stacks principal
   * @returns KYC details or null
   */
  async getKYC(userPrincipal: string): Promise<KYCStatus | null> {
    const status = await this.hasKYC(userPrincipal);
    return status.hasKYC ? status : null;
  }

  /**
   * Extract contract address and name from a contract identifier
   */
  private getContractAddress(contractId: string): { address: string; name: string } {
    const parts = contractId.split('.');
    if (parts.length !== 2) {
      throw new Error(`Invalid contract address format: ${contractId}`);
    }
    return {
      address: parts[0],
      name: parts[1],
    };
  }
}

