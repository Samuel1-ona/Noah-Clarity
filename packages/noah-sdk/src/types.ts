/**
 * Type definitions for Noah-v2 SDK
 */

export interface KYCStatus {
  hasKYC: boolean;
  commitment?: string;
  attesterId?: number;
  registeredAt?: number;
}

export interface RegisterKYCParams {
  commitment: string;
  signature: string;
  attesterId: number;
}

export interface ProofRequest {
  age: string;
  jurisdiction: string;
  is_accredited: string;
  identity_data: string;
  nonce: string;
  min_age: string;
  allowed_jurisdictions: string[];
  require_accreditation: string;
  commitment: string;
}

export interface ProofResponse {
  proof: string;
  public_inputs: string[];
  commitment: string;
  success: boolean;
  error?: string;
}

export interface AttestationRequest {
  commitment: string;
  public_inputs: string[];
  proof: string;
  user_id: string;
}

export interface AttestationResponse {
  commitment: string;
  signature: string;
  attester_id: number;
  success: boolean;
  error?: string;
}

export interface SDKConfig {
  kycRegistryAddress: string;
  attesterRegistryAddress: string;
  proverServiceUrl?: string;
  attesterServiceUrl?: string;
  network?: 'mainnet' | 'testnet' | 'devnet';
}

export interface WalletConfig {
  appName: string;
  appIcon?: string;
  redirectPath?: string;
}

