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

    // #region agent log
    console.log('Transaction sender address (derived from private key):', senderAddress);
    console.log('Network version:', this.network.version);
    fetch('http://127.0.0.1:7249/ingest/b239a7fb-669e-478f-b888-bd46beaadedf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'contract.ts:50','message':'registerKYC entry','data':{senderAddress,network:this.network.coreApiUrl,networkVersion:this.network.version,attesterId:params.attesterId,commitmentLength:params.commitment.length,signatureLength:params.signature.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion agent log

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

    // #region agent log
    fetch('http://127.0.0.1:7249/ingest/b239a7fb-669e-478f-b888-bd46beaadedf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'contract.ts:74','message':'Transaction options before makeContractCall','data':{contractAddress:address,contractName:name,functionName:'register-kyc',fee:txOptions.fee,anchorMode:txOptions.anchorMode,postConditionMode:txOptions.postConditionMode,networkUrl:this.network.coreApiUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion agent log

    try {
      const transaction = await makeContractCall(txOptions);
      
      // #region agent log
      const serializedTx = transaction.serialize();
      const nonceValue = (transaction as any).auth?.spendingCondition?.nonce;
      const txData = {
        txId: transaction.txid(),
        nonce: typeof nonceValue === 'bigint' ? nonceValue.toString() : nonceValue,
        serializedTxLength: serializedTx.byteLength,
      };
      fetch('http://127.0.0.1:7249/ingest/b239a7fb-669e-478f-b888-bd46beaadedf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'contract.ts:87','message':'Transaction created, before broadcast','data':txData,timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion agent log
      
      // #region agent log
      fetch('http://127.0.0.1:7249/ingest/b239a7fb-669e-478f-b888-bd46beaadedf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'contract.ts:108','message':'About to call broadcastTransaction','data':{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion agent log
      
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
      // #region agent log
      fetch('http://127.0.0.1:7249/ingest/b239a7fb-669e-478f-b888-bd46beaadedf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'contract.ts:110','message':'Caught error in registerKYC','data':{errorType:error?.constructor?.name,hasMessage:!!error?.message,message:error?.message?.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion agent log
      
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
      
      // #region agent log
      const errorKeys = error ? Object.keys(error) : [];
      const errorStructure = {
        hasError: !!error,
        hasResponse: !!error?.response,
        hasData: !!error?.data,
        hasStatus: !!error?.status,
        hasStatusText: !!error?.statusText,
        hasReason: !!error?.reason,
        hasMessage: !!error?.message,
        errorKeys: errorKeys,
        errorType: error?.constructor?.name,
        status: error?.status,
        statusText: error?.statusText,
        message: error?.message,
      };
      fetch('http://127.0.0.1:7249/ingest/b239a7fb-669e-478f-b888-bd46beaadedf',{method:'POST',headers:{'Content-Type':'application/json'},body:safeStringify({location:'contract.ts:135','message':'Error object structure','data':errorStructure,timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion agent log
      
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
      
      // #region agent log
      fetch('http://127.0.0.1:7249/ingest/b239a7fb-669e-478f-b888-bd46beaadedf',{method:'POST',headers:{'Content-Type':'application/json'},body:safeStringify({location:'contract.ts:120','message':'Error details captured','data':errorDetails,timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion agent log
      
      // Try to extract response body if it exists
      let responseBody = null;
      if (error?.response?.data) {
        responseBody = typeof error.response.data === 'string' ? error.response.data : safeExtract(error.response.data);
      } else if (error?.data) {
        responseBody = typeof error.data === 'string' ? error.data : safeExtract(error.data);
      }
      
      // #region agent log
      if (responseBody) {
        fetch('http://127.0.0.1:7249/ingest/b239a7fb-669e-478f-b888-bd46beaadedf',{method:'POST',headers:{'Content-Type':'application/json'},body:safeStringify({location:'contract.ts:135','message':'API response body','data':{responseBody:typeof responseBody === 'string' ? responseBody : safeStringify(responseBody)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      }
      // #endregion agent log
      
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

    // #region agent log
    fetch('http://127.0.0.1:7249/ingest/b239a7fb-669e-478f-b888-bd46beaadedf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'contract.ts:269','message':'hasKYC called','data':{userPrincipal,contractAddress:this.config.kycRegistryAddress,parsedAddress:address,parsedName:name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion agent log

    try {
      const result = await callReadOnlyFunction({
        contractAddress: address,
        contractName: name,
        functionName: 'has-kyc?',
        functionArgs: [principalCV(userPrincipal)],
        network: this.network,
        senderAddress: address, // Use contract address as sender for read-only calls
      });

      // #region agent log
      console.log('hasKYC callReadOnlyFunction result (before cvToJSON):', result);
      console.log('hasKYC result type:', typeof result);
      console.log('hasKYC result constructor:', result?.constructor?.name);
      fetch('http://127.0.0.1:7249/ingest/b239a7fb-669e-478f-b888-bd46beaadedf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'contract.ts:277','message':'hasKYC callReadOnlyFunction result','data':{userPrincipal,resultType:typeof result,resultConstructor:result?.constructor?.name,resultString:String(result)},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'A'})}).catch(()=>{});
      // #endregion agent log

      const jsonResult = cvToJSON(result);
      
      // #region agent log
      console.log('hasKYC raw result (after cvToJSON):', JSON.stringify(jsonResult, null, 2));
      console.log('hasKYC jsonResult.type:', jsonResult.type);
      console.log('hasKYC jsonResult.value:', jsonResult.value);
      console.log('hasKYC jsonResult.value type:', typeof jsonResult.value);
      console.log('hasKYC jsonResult.success:', jsonResult.success);
      fetch('http://127.0.0.1:7249/ingest/b239a7fb-669e-478f-b888-bd46beaadedf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'contract.ts:290','message':'hasKYC result after cvToJSON','data':{userPrincipal,resultType:jsonResult.type,resultValue:jsonResult.value,resultValueType:typeof jsonResult.value,resultSuccess:jsonResult.success,fullResult:JSON.stringify(jsonResult)},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'B'})}).catch(()=>{});
      // #endregion agent log
      
      // Result is (ok bool), cvToJSON returns:
      // { type: '(response bool UnknownType)', value: { type: 'bool', value: true }, success: true }
      // Check success field or response type, then extract boolean from value.value
      if (jsonResult.success === true || (jsonResult.type && jsonResult.type.includes('response'))) {
        // Extract the boolean value from the nested structure
        const boolValue = jsonResult.value?.value;
        const hasKYC = boolValue === true;
        console.log('hasKYC final result:', hasKYC, 'jsonResult.value.value:', boolValue, 'type:', typeof boolValue);
        return { hasKYC };
      } else {
        console.log('hasKYC: response not ok, type:', jsonResult.type, 'success:', jsonResult.success, 'full result:', JSON.stringify(jsonResult));
        return { hasKYC: false };
      }
    } catch (error) {
      // #region agent log
      console.error('hasKYC exception:', error);
      fetch('http://127.0.0.1:7249/ingest/b239a7fb-669e-478f-b888-bd46beaadedf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'contract.ts:294','message':'hasKYC error','data':{userPrincipal,error:error instanceof Error ? error.message : String(error),errorStack:error instanceof Error ? error.stack : undefined},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion agent log
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

