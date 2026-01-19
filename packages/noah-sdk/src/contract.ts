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

    // Ensure commitment is exactly 32 bytes (64 hex chars)
    const commitmentHex = params.commitment.replace('0x', '');
    const commitmentBuffer = Buffer.from(commitmentHex, 'hex');
    if (commitmentBuffer.length !== 32) {
      throw new Error(`Invalid commitment length: expected 32 bytes, got ${commitmentBuffer.length}. Hex: ${commitmentHex.substring(0, 20)}...`);
    }

    // Ensure signature is 64 or 65 bytes (128 or 130 hex chars)
    const signatureHex = params.signature.replace('0x', '');
    const signatureBuffer = Buffer.from(signatureHex, 'hex');
    if (signatureBuffer.length !== 64 && signatureBuffer.length !== 65) {
      throw new Error(`Invalid signature length: expected 64 or 65 bytes, got ${signatureBuffer.length}. Hex: ${signatureHex.substring(0, 20)}...`);
    }

    const functionArgs = [
      bufferCV(commitmentBuffer),
      bufferCV(signatureBuffer),
      uintCV(params.attesterId),
    ];

    const txOptions = {
      contractAddress: address,
      contractName: name,
      functionName: 'register-kyc',
      functionArgs,
      senderKey: privateKey,
      fee: 5000, // Increased from 1000 to 5000 microSTX (0.005 STX) for better reliability
      network: this.network,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
    };

    try {
      const transaction = await makeContractCall(txOptions);
      
      try {
      const broadcastResponse = await broadcastTransaction(transaction, this.network);
      return broadcastResponse.txid;
      } catch (broadcastError: any) {
        // Log the error immediately with console.error to ensure we see it
        console.error('broadcastTransaction error:', broadcastError);
        // Re-throw to be caught by outer catch block
        throw broadcastError;
      }
    } catch (error: any) {
      // Helper function to safely serialize data (handles BigInt)
      const safeStringify = (obj: any): string => {
        try {
          return JSON.stringify(obj, (key, value) => {
            if (typeof value === 'bigint') {
              return value.toString();
            }
            return value;
          });
        } catch (e) {
          return String(obj);
        }
      };
      
      // Helper function to safely extract error data (handles BigInt)
      const safeExtract = (obj: any): any => {
        if (obj === null || obj === undefined) return obj;
        if (typeof obj === 'string') return obj;
        if (typeof obj === 'bigint') return obj.toString();
        if (typeof obj !== 'object') return obj;
        const result: any = {};
        try {
          for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
              const value = obj[key];
              if (typeof value === 'bigint') {
                result[key] = value.toString();
              } else if (typeof value === 'object' && value !== null) {
                result[key] = safeExtract(value);
              } else {
                result[key] = value;
              }
            }
          }
        } catch (e) {
          return String(obj);
        }
        return result;
      };
      
      // Capture detailed error information
      let errorMessage = 'Transaction failed';
      let errorDetails: any = {};
      
      if (error instanceof Error) {
        errorMessage = error.message;
        errorDetails.message = error.message;
      }
      
      // Try to extract API response details (safely handle BigInt)
      if (error?.error) {
        errorDetails.apiError = typeof error.error === 'string' ? error.error : safeExtract(error.error);
        errorMessage = typeof error.error === 'string' ? error.error : String(error.error);
      }
      if (error?.reason) {
        errorDetails.reason = typeof error.reason === 'string' ? error.reason : safeExtract(error.reason);
        errorMessage = typeof error.reason === 'string' ? error.reason : String(error.reason);
      }
      if (error?.response) {
        try {
          if (typeof error.response === 'string') {
            errorDetails.response = error.response;
          } else {
            errorDetails.response = safeStringify(safeExtract(error.response));
          }
        } catch (e) {
          errorDetails.response = String(error.response);
        }
      }
      if (error?.data) {
        errorDetails.data = typeof error.data === 'string' ? error.data : safeStringify(safeExtract(error.data));
      }
      if (error?.status) errorDetails.status = error.status;
      if (error?.statusText) errorDetails.statusText = error.statusText;
      
      // Try to extract response body if it exists
      let responseBody = null;
      if (error?.response?.data) {
        responseBody = typeof error.response.data === 'string' ? error.response.data : safeExtract(error.response.data);
      } else if (error?.data) {
        responseBody = typeof error.data === 'string' ? error.data : safeExtract(error.data);
      }
      
      // Extract error details from response body for user-friendly messages
      let userFriendlyMessage = errorMessage;
      if (responseBody && typeof responseBody === 'object') {
        if (responseBody.reason === 'NotEnoughFunds') {
          const expected = responseBody.reason_data?.expected;
          const expectedStx = expected ? (parseInt(expected, 16) / 1_000_000).toFixed(6) : '0.005';
          userFriendlyMessage = `Insufficient STX balance. You need at least ${expectedStx} STX to pay for the transaction fee. Please fund your account with STX and try again.`;
        } else if (responseBody.reason) {
          userFriendlyMessage = `Transaction rejected: ${responseBody.reason}${responseBody.error ? ' - ' + responseBody.error : ''}`;
        } else if (responseBody.error) {
          userFriendlyMessage = responseBody.error;
        }
      }
      
      // Log the full error for debugging (using safe extraction)
      const safeErrorDetails = safeExtract(errorDetails);
      console.error('Transaction broadcast error:', safeErrorDetails);
      
      // Provide detailed error message
      const detailedMessage = userFriendlyMessage || (typeof responseBody === 'string' ? responseBody : (errorDetails.response || errorDetails.reason || errorDetails.apiError || errorDetails.data || errorMessage));
      throw new Error(detailedMessage);
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
      
      // Result is (ok bool), cvToJSON returns:
      // { type: '(response bool UnknownType)', value: { type: 'bool', value: true }, success: true }
      // Check success field or response type, then extract boolean from value.value
      if (jsonResult.success === true || (jsonResult.type && jsonResult.type.includes('response'))) {
        // Extract the boolean value from the nested structure
        const boolValue = jsonResult.value?.value;
        const hasKYC = boolValue === true;
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
   * Get revocation root from the revocation registry contract
   * @returns Revocation root (32-byte hex string) or null if contract not configured
   */
  async getRevocationRoot(): Promise<string | null> {
    if (!this.config.revocationRegistryAddress) {
      return null;
    }

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

      const jsonResult = cvToJSON(result);
      
      // Result is (ok (buff 32))
      if (jsonResult.success === true || (jsonResult.type && jsonResult.type.includes('response'))) {
        const rootValue = jsonResult.value?.value;
        if (rootValue) {
          // Convert buffer to hex string
          return rootValue.startsWith('0x') ? rootValue : `0x${rootValue}`;
        }
      }
      return null;
    } catch (error) {
      console.error('Error fetching revocation root:', error);
      return null;
    }
  }

  /**
   * Check if a commitment is revoked by querying the attester service
   * @param commitment Commitment to check (hex string)
   * @returns true if revoked, false if not revoked or if revocation checking is unavailable
   */
  async isCommitmentRevoked(commitment: string): Promise<boolean> {
    // If no attester service URL configured, skip revocation check
    if (!this.config.attesterServiceUrl) {
      return false;
    }

    try {
      // Query attester service for revocation status
      const url = `${this.config.attesterServiceUrl}/revocation/check?commitment=${encodeURIComponent(commitment)}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        // If service unavailable, assume not revoked (fail open)
        console.warn('Revocation check service unavailable, assuming not revoked');
        return false;
      }

      const data = await response.json() as { revoked?: boolean; commitment?: string };
      return data.revoked === true;
    } catch (error) {
      // On error, assume not revoked (fail open)
      console.error('Error checking revocation status:', error);
      return false;
    }
  }

  /**
   * Check if KYC is valid
   * Now includes revocation checking
   * @param userPrincipal User's Stacks principal
   * @returns true if KYC is valid (exists and not revoked)
   */
  async isKYCValid(userPrincipal: string): Promise<boolean> {
    // First check if user has KYC record
    const kycDetails = await this.getKYC(userPrincipal);

    if (!kycDetails || !kycDetails.hasKYC || !kycDetails.commitment) {
      return false;
    }

    // Check revocation status
    const isRevoked = await this.isCommitmentRevoked(kycDetails.commitment);

    if (isRevoked) {
      return false;
    }

    return true;
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
      // cvToJSON returns structure: { success: true, type: "...", value: { type: "(optional ...)", value: { type: "(tuple ...)", value: { ... } } } }
      if (jsonResult.success === true && jsonResult.value?.value?.value) {
        const record = jsonResult.value.value.value;
        const result: KYCStatus = {
          hasKYC: true,
          commitment: record.commitment?.value,
          attesterId: record['attester-id']?.value,
          registeredAt: record['registered-at']?.value,
        };
        
        // Add history fields if present
        if (record['previous-commitment']?.value) {
          result.previousCommitment = record['previous-commitment'].value;
        }
        if (record['previous-registered-at']?.value !== undefined) {
          result.previousRegisteredAt = record['previous-registered-at'].value;
        }
        
        return result;
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

