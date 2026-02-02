/**
 * Type definitions for Noah-v2 SDK
 */

export interface DocumentInfo {
  document_type: string;
  document_number: string;
  country: string;
  issue_date?: string;
  expiry_date?: string;
}

export interface Point {
  x: string;
  y: string;
}

export interface EdDSASignature {
  r: Point;
  s: string;
}

export interface EdDSAPublicKey {
  a: Point;
}

export interface KYCStatus {
  hasKYC: boolean;
  commitment?: string;
  attesterId?: number;
  registeredAt?: number;
  expiry?: number;
  previousCommitment?: string;
  previousRegisteredAt?: number;
}

export interface AttesterRecord {
  id: number;
  pubkey: string;
  address: string;
  active: boolean;
}

export interface RevocationStats {
  root: string;
  height: number;
}

export interface RegisterKYCParams {
  commitment: string;
  signature: string;
  attesterId: number;
}

export interface CredentialRequest {
  user_id: string;
  user_address: string;
  identity_data?: string;
  nonce?: string;
  user_commitment?: string;
  attributes: Record<string, any>;
  documents: DocumentInfo[];
}

export interface CredentialResponse {
  success: boolean;
  credential?: any; // The full signed credential object
  error?: string;
}

export interface AttesterInfo {
  attester_id: number;
  public_key: string; // ECDSA Public Key (hex)
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
  signature: EdDSASignature;
  attester_pub_key: EdDSAPublicKey;
  user_address: string;
}

export interface ProofResponse {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  success: boolean;
  error?: string;
}

export interface ProofResult {
  proof: string;
  public_inputs: string[];
  commitment: string;
}

export interface JobStatusResponse {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: ProofResult;
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
  signature: string; // ECDSA (Standard Stacks signature)
  eddsa_signature: EdDSASignature; // EdDSA (BN254 Baby-Jubjub)
  attester_public_key: EdDSAPublicKey;
  attester_id: number;
  expiry: number; // Expiration timestamp
  success: boolean;
  error?: string;
}

export interface SDKConfig {
  kycRegistryAddress: string;
  attesterRegistryAddress: string;
  revocationRegistryAddress?: string;
  proverServiceUrl?: string;
  attesterServiceUrl?: string;
  stacksApiUrl?: string;
  network?: 'mainnet' | 'testnet' | 'devnet';
}

export interface WalletConfig {
  appName: string;
  appIcon?: string;
  redirectPath?: string;
}

/**
 * Protocol-specific KYC requirements
 * Protocols define these requirements off-chain (e.g., in JSON/metadata)
 */
export interface ProtocolRequirements {
  min_age: number;
  allowed_jurisdictions: number[];
  require_accreditation: boolean;
}

/**
 * Persistence layer for long-running jobs
 */
export interface StorageInterface {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/**
 * Noah SDK Events
 */
export type NoahEvent =
  | 'proof-started'
  | 'proof-progress'
  | 'proof-completed'
  | 'attestation-received'
  | 'tx-broadcasted'
  | 'tx-confirmed'
  | 'error';

/**
 * Unified KYC Lifecycle State
 */
export interface KYCLifecycleState {
  currentStage: 'idle' | 'proving' | 'attesting' | 'registering' | 'completed' | 'failed';
  jobId?: string;
  txId?: string;
  error?: string;
  progress?: number;
}

