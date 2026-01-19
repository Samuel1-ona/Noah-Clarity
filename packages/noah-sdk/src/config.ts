/**
 * Configuration loader for contract addresses
 */

export interface ContractAddresses {
  network: string;
  deployer: string;
  contracts: {
    'attester-registry': string;
    'attester-registry-trait': string;
    'kyc-registry': string;
    'revocation': string;
  };
  deployment_date?: string;
  description?: string;
}

/**
 * Default testnet contract addresses (deployed)
 */
export const TESTNET_CONTRACTS: ContractAddresses = {
  network: 'testnet',
  deployer: 'STVAH96MR73TP2FZG2W4X220MEB4NEMJHPMVYQNS',
  contracts: {
    'attester-registry': 'STVAH96MR73TP2FZG2W4X220MEB4NEMJHPMVYQNS.Attester-registry',
    'attester-registry-trait': 'STVAH96MR73TP2FZG2W4X220MEB4NEMJHPMVYQNS.attester-registry-trait',
    'kyc-registry': 'STVAH96MR73TP2FZG2W4X220MEB4NEMJHPMVYQNS.KYc-registry',
    'revocation': 'STVAH96MR73TP2FZG2W4X220MEB4NEMJHPMVYQNS.revocation',
  },
  deployment_date: '2025-01-17',
  description: 'Deployed contract addresses for Noah-v2 KYC Registry system on Stacks Testnet',
};

/**
 * Load contract addresses from JSON file or use defaults
 * In browser environments, this can load from a static JSON file
 * In Node.js, can use fs to read the JSON file
 */
export function loadContractAddresses(network: 'testnet' | 'mainnet' | 'devnet' = 'testnet'): ContractAddresses {
  // For now, return hardcoded testnet addresses
  // In production, you might want to:
  // 1. Load from a JSON file
  // 2. Fetch from a registry/API
  // 3. Use environment variables
  
  if (network === 'testnet') {
    return TESTNET_CONTRACTS;
  }
  
  // TODO: Add mainnet addresses when deployed
  throw new Error(`Contract addresses for ${network} not yet configured`);
}

/**
 * Create SDK config from contract addresses
 */
export function createSDKConfig(
  addresses: ContractAddresses,
  options?: {
    proverServiceUrl?: string;
    attesterServiceUrl?: string;
  }
) {
  return {
    kycRegistryAddress: addresses.contracts['kyc-registry'],
    attesterRegistryAddress: addresses.contracts['attester-registry'],
    revocationRegistryAddress: addresses.contracts['revocation'],
    network: addresses.network as 'testnet' | 'mainnet' | 'devnet',
    proverServiceUrl: options?.proverServiceUrl || 'http://localhost:8080',
    attesterServiceUrl: options?.attesterServiceUrl || 'http://localhost:8081',
  };
}

