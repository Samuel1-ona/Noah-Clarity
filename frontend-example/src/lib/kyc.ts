/**
 * KYC SDK integration
 * This demonstrates how to use the SDK in a frontend application
 */

import { KYCContract, ProofService, SDKConfig } from 'noah-clarity';

const SDK_CONFIG: SDKConfig = {
  kycRegistryAddress: import.meta.env.VITE_KYC_REGISTRY || 'STVAH96MR73TP2FZG2W4X220MEB4NEMJHPMVYQNS.kyc-registry',
  attesterRegistryAddress: import.meta.env.VITE_ATTESTER_REGISTRY || 'STVAH96MR73TP2FZG2W4X220MEB4NEMJHPMVYQNS.attester-registry',
  proverServiceUrl: import.meta.env.VITE_PROVER_URL || 'http://localhost:8080',
  attesterServiceUrl: import.meta.env.VITE_ATTESTER_URL || 'http://localhost:8081',
  network: (import.meta.env.VITE_NETWORK as 'mainnet' | 'testnet') || 'testnet',
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

