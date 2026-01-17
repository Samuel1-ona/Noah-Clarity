/**
 * KYC SDK integration
 * This demonstrates how to use the SDK in a frontend application
 */

import { KYCContract, ProofService, SDKConfig } from '@noah-v2/sdk';

const SDK_CONFIG: SDKConfig = {
  kycRegistryAddress: process.env.REACT_APP_KYC_REGISTRY || 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.kyc-registry',
  attesterRegistryAddress: process.env.REACT_APP_ATTESTER_REGISTRY || 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.attester-registry',
  proverServiceUrl: process.env.REACT_APP_PROVER_URL || 'http://localhost:8080',
  attesterServiceUrl: process.env.REACT_APP_ATTESTER_URL || 'http://localhost:8081',
  network: (process.env.REACT_APP_NETWORK as 'mainnet' | 'testnet') || 'testnet',
};

export const kycContract = new KYCContract(SDK_CONFIG);
export const proofService = new ProofService(SDK_CONFIG);

/**
 * Check KYC status for a user
 */
export async function checkKYCStatus(userAddress: string) {
  return await kycContract.hasKYC(userAddress);
}

/**
 * Check if KYC is valid
 */
export async function isKYCValid(userAddress: string): Promise<boolean> {
  return await kycContract.isKYCValid(userAddress);
}

