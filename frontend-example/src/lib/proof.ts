/**
 * Proof generation client
 */

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

const PROVER_SERVICE_URL = import.meta.env.VITE_PROVER_URL || 'http://localhost:8080';

export async function generateProof(request: ProofRequest): Promise<ProofResponse> {
  const response = await fetch(`${PROVER_SERVICE_URL}/proof/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Proof generation failed');
  }

  return response.json();
}

