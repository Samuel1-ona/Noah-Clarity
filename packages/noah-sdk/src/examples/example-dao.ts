/**
 * Example: DAO Integration
 * Demonstrates how to use the SDK in a DAO for gated voting
 */

import { NoahSDK, SDKConfig, WalletConfig } from '../index';

// Initialize SDK
const sdkConfig: SDKConfig = {
  kycRegistryAddress: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.kyc-registry',
  attesterRegistryAddress: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.attester-registry',
  network: 'testnet',
};

const walletConfig: WalletConfig = {
  appName: 'Example DAO',
};

const sdk = new NoahSDK(sdkConfig, walletConfig);

/**
 * Example: Check KYC before allowing vote
 */
export async function checkKYCBeforeVote(userAddress: string): Promise<boolean> {
  const kycStatus = await sdk.contract.getKYC(userAddress);
  
  if (!kycStatus || !kycStatus.hasKYC) {
    console.log('User must complete KYC before voting');
    return false;
  }

  const isValid = await sdk.contract.isKYCValid(userAddress);
  if (!isValid) {
    console.log('User KYC has expired');
    return false;
  }

  return true;
}

/**
 * Example: Gate proposal creation with KYC
 */
export async function canCreateProposal(userAddress: string): Promise<boolean> {
  return await checkKYCBeforeVote(userAddress);
}

