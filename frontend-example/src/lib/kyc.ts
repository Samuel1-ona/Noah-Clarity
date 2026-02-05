/**
 * KYC SDK integration
 * This demonstrates how to use the SDK in a frontend application
 */

import { NoahSDK } from 'noah-clarity';
import type { SDKConfig, ProtocolRequirements } from 'noah-clarity';
import { openContractCall } from '@stacks/connect';
import { bufferCV, uintCV } from '@stacks/transactions';
import { getNetwork } from './stacks';

const SDK_CONFIG: SDKConfig = {
  kycRegistryAddress: import.meta.env.VITE_KYC_REGISTRY || 'ST2N04CYE3CQ1S354MZX4KHYJYD4QW25ZW37GQY7J.kyc-registry',
  attesterRegistryAddress: import.meta.env.VITE_ATTESTER_REGISTRY || 'ST2N04CYE3CQ1S354MZX4KHYJYD4QW25ZW37GQY7J.attester-registry',
  proverServiceUrl: import.meta.env.VITE_PROVER_URL || 'http://localhost:8080',
  attesterServiceUrl: import.meta.env.VITE_ATTESTER_URL || 'http://localhost:8081',
  network: (import.meta.env.VITE_NETWORK as 'mainnet' | 'testnet') || 'testnet',
};

const WALLET_CONFIG = {
  appName: 'Noah-v2 KYC Demo',
};

// Initialize SDK instance
export const sdk = new NoahSDK(SDK_CONFIG, WALLET_CONFIG);

/**
 * Check KYC status for a user
 */
export async function checkKYCStatus(userAddress: string) {
  const status = await sdk.contract.getKYC(userAddress);
  return status || { hasKYC: false };
}

/**
 * Check if KYC is valid
 */
export async function isKYCValid(userAddress: string): Promise<boolean> {
  console.log('isKYCValid called with address:', userAddress);
  console.log('SDK config kycRegistryAddress:', SDK_CONFIG.kycRegistryAddress);
  const result = await sdk.contract.isKYCValid(userAddress);
  console.log('isKYCValid result:', result);
  return result;
}

/**
 * Verify passport document via OCR
 * Sends multipart form data to the attester service
 */
export async function verifyPassport(file: File): Promise<{ success: boolean; data?: any; error?: string }> {
  const formData = new FormData();
  formData.append('passport', file);

  try {
    const response = await fetch(`${SDK_CONFIG.attesterServiceUrl}/passport/verify`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('Passport verification failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to connect to attester service',
    };
  }
}

/**
 * Request an EdDSA signed credential from the attester
 */
export async function requestCredential(
  userAddress: string,
  userCredential: {
    age: string;
    jurisdiction: string;
    is_accredited: string;
    identity_data: string;
    nonce: string;
  }
): Promise<{ success: boolean; credential?: any; error?: string }> {
  try {
    const response = await fetch(`${SDK_CONFIG.attesterServiceUrl}/credential/issue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userAddress,
        user_address: userAddress,
        identity_data: userCredential.identity_data,
        nonce: userCredential.nonce,
        attributes: {
          age: parseInt(userCredential.age),
          jurisdiction: parseInt(userCredential.jurisdiction),
          is_accredited: userCredential.is_accredited === '1',
        },
        documents: [], // In a full flow, we'd attach OCR results here if needed for server validation
      }),
    });

    return await response.json();
  } catch (error: any) {
    console.error('Credential request failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to request credential',
    };
  }
}


/**
 * Complete KYC registration flow with protocol requirements
 * Uses wallet extension to sign transactions (uses connected wallet address)
 */
export async function registerKYCWithProtocol(
  userAddress: string,
  userCredential: {
    age: string;
    jurisdiction: string;
    is_accredited: string;
    identity_data: string;
    nonce: string;
  },
  protocolRequirements: ProtocolRequirements
): Promise<string> {
  // Step 1: Get signed credential from attester (EdDSA)
  const credentialResponse = await requestCredential(userAddress, userCredential);
  if (!credentialResponse.success || !credentialResponse.credential) {
    throw new Error(credentialResponse.error || 'Failed to get credential from attester');
  }

  const { eddsa_signature, attester_public_key } = credentialResponse.credential;

  // Step 2: Generate proof matching protocol requirements (Submit Job)
  const proofJobResponse = await sdk.proof.generateProofForProtocol(
    {
      ...userCredential,
      signature: eddsa_signature,
      attester_pub_key: attester_public_key,
      user_address: userAddress,
    },
    protocolRequirements
  );

  if (!proofJobResponse.success) {
    throw new Error(proofJobResponse.error || 'Proof job submission failed');
  }

  // Step 3: Wait for proof completion
  const proofResult = await sdk.proof.waitForProof(proofJobResponse.job_id);

  // Step 4: Get on-chain attestation for the proof
  const attestationResponse = await sdk.proof.requestAttestation({
    commitment: proofResult.commitment,
    public_inputs: proofResult.public_inputs,
    proof: proofResult.proof,
    user_id: userAddress,
  });

  if (!attestationResponse.success) {
    throw new Error(attestationResponse.error || 'Attestation failed');
  }



  // Parse contract address
  const contractId = SDK_CONFIG.kycRegistryAddress;
  const parts = contractId.split('.');
  if (parts.length !== 2) {
    throw new Error(`Invalid contract address format: ${contractId}`);
  }
  const contractAddress = parts[0];
  const contractName = parts[1];

  // Ensure commitment is exactly 32 bytes (64 hex chars)
  const commitmentHex = attestationResponse.commitment.replace('0x', '');
  if (commitmentHex.length !== 64) {
    throw new Error(`Invalid commitment length: expected 64 hex chars (32 bytes), got ${commitmentHex.length}`);
  }

  // Ensure signature is 64 or 65 bytes (128 or 130 hex chars)
  const signatureHex = attestationResponse.signature.replace('0x', '');
  if (signatureHex.length !== 128 && signatureHex.length !== 130) {
    throw new Error(`Invalid signature length: expected 128 or 130 hex chars (64 or 65 bytes), got ${signatureHex.length}`);
  }

  // Convert hex strings to Buffer for bufferCV
  const commitmentBuffer = Buffer.from(commitmentHex, 'hex');
  const signatureBuffer = Buffer.from(signatureHex, 'hex');


  // Use type assertion to work around version mismatch between @stacks/connect (v4.3.2 bundled) 
  // and standalone @stacks/transactions (v6.17.0). Runtime types are compatible.
  // Use openContractCall to sign with wallet extension (uses connected wallet address)
  return new Promise((resolve, reject) => {
    openContractCall({
      contractAddress,
      contractName,
      functionName: 'register-kyc',
      functionArgs: [
        bufferCV(commitmentBuffer) as any,
        bufferCV(signatureBuffer) as any,
        uintCV(attestationResponse.attester_id) as any,
      ],
      network: getNetwork(),
      onFinish: (data) => {
        resolve(data.txId);
      },
      onCancel: () => {
        reject(new Error('Transaction cancelled by user'));
      },
    }).catch((error) => {
      reject(error);
    });
  });
}

