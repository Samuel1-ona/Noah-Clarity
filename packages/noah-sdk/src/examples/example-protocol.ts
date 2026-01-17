/**
 * Example: DeFi Protocol Integration
 * Demonstrates how to use the SDK in a DeFi protocol
 */

import { NoahSDK, SDKConfig, WalletConfig } from '../index';

// Initialize SDK
const sdkConfig: SDKConfig = {
  kycRegistryAddress: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.kyc-registry',
  attesterRegistryAddress: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.attester-registry',
  proverServiceUrl: 'http://localhost:8080',
  attesterServiceUrl: 'http://localhost:8081',
  network: 'testnet',
};

const walletConfig: WalletConfig = {
  appName: 'Example DeFi Protocol',
};

const sdk = new NoahSDK(sdkConfig, walletConfig);

/**
 * Example: Check KYC before allowing deposit
 */
export async function checkKYCBeforeDeposit(userAddress: string): Promise<boolean> {
  const hasKYC = await sdk.contract.hasKYC(userAddress);
  if (!hasKYC.hasKYC) {
    console.log('User does not have KYC');
    return false;
  }

  const isValid = await sdk.contract.isKYCValid(userAddress);
  if (!isValid) {
    console.log('User KYC has expired');
    return false;
  }

  console.log('User has valid KYC');
  return true;
}

/**
 * Example: Require KYC for protocol access
 */
export async function requireKYC(userAddress: string): Promise<void> {
  const isValid = await sdk.contract.isKYCValid(userAddress);
  if (!isValid) {
    throw new Error('KYC required to access this protocol');
  }
}

