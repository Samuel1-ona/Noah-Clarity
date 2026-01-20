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
  kycRegistryAddress: import.meta.env.VITE_KYC_REGISTRY || 'STVAH96MR73TP2FZG2W4X220MEB4NEMJHPMVYQNS.KYc-registry',
  attesterRegistryAddress: import.meta.env.VITE_ATTESTER_REGISTRY || 'STVAH96MR73TP2FZG2W4X220MEB4NEMJHPMVYQNS.Attester-registry',
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
  return await sdk.contract.hasKYC(userAddress);
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
 * Generate proof matching protocol requirements
 */
export async function generateProofForProtocol(
  userCredential: {
    age: string;
    jurisdiction: string;
    is_accredited: string;
    identity_data: string;
    nonce: string;
  },
  protocolRequirements: ProtocolRequirements
) {
  return await sdk.proof.generateProofForProtocol(userCredential, protocolRequirements);
}

/**
 * Complete KYC registration flow with protocol requirements
 * Uses wallet extension to sign transactions (uses connected wallet address)
 */
export async function registerKYCWithProtocol(
  userCredential: {
    age: string;
    jurisdiction: string;
    is_accredited: string;
    identity_data: string;
    nonce: string;
  },
  protocolRequirements: ProtocolRequirements
): Promise<string> {
  // Generate proof matching protocol requirements
  const proofResponse = await sdk.proof.generateProofForProtocol(userCredential, protocolRequirements);

  if (!proofResponse.success) {
    throw new Error(proofResponse.error || 'Proof generation failed');
  }

  // Get attestation from attester
  const attestationResponse = await sdk.proof.requestAttestation({
    commitment: proofResponse.commitment,
    public_inputs: proofResponse.public_inputs,
    proof: proofResponse.proof,
    user_id: userCredential.identity_data,
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

