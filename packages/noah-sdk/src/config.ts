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
  deployer: 'ST2N04CYE3CQ1S354MZX4KHYJYD4QW25ZW37GQY7J',
  contracts: {
    'attester-registry': 'ST2N04CYE3CQ1S354MZX4KHYJYD4QW25ZW37GQY7J.attester-registry',
    'attester-registry-trait': 'ST2N04CYE3CQ1S354MZX4KHYJYD4QW25ZW37GQY7J.attester-registry-trait',
    'kyc-registry': 'ST2N04CYE3CQ1S354MZX4KHYJYD4QW25ZW37GQY7J.kyc-registry',
    'revocation': 'ST2N04CYE3CQ1S354MZX4KHYJYD4QW25ZW37GQY7J.revocation',
  },
  deployment_date: '2025-01-17',
  description: 'Deployed contract addresses for Noah-v2 KYC Registry system on Stacks Testnet',
};

/**
 * Load contract addresses from JSON file or use defaults
 */
export function loadContractAddresses(networkOrConfig: 'testnet' | 'mainnet' | 'devnet' | ContractAddresses = 'testnet'): ContractAddresses {
  if (typeof networkOrConfig === 'object') {
    return networkOrConfig;
  }

  if (networkOrConfig === 'testnet') {
    return TESTNET_CONTRACTS;
  }

  throw new Error(`Contract addresses for ${networkOrConfig} not yet configured`);
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

