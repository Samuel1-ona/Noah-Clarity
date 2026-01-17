import React, { useState } from 'react';
import { generateProof } from '../lib/proof';
import { getUserAddress } from '../lib/stacks';

interface KYCFormProps {
  onSuccess?: () => void;
}

export const KYCForm: React.FC<KYCFormProps> = ({ onSuccess }) => {
  const [age, setAge] = useState('');
  const [jurisdiction, setJurisdiction] = useState('');
  const [isAccredited, setIsAccredited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const userAddress = getUserAddress();
      if (!userAddress) {
        throw new Error('Please connect your wallet first');
      }

      // Generate commitment (simplified - in production, use proper hash)
      const identityData = userAddress;
      const nonce = Math.random().toString(36).substring(7);
      const commitment = await generateCommitment(identityData, nonce);

      // Generate proof
      const proofRequest = {
        age: age,
        jurisdiction: jurisdiction,
        is_accredited: isAccredited ? '1' : '0',
        identity_data: identityData,
        nonce: nonce,
        min_age: '18',
        allowed_jurisdictions: ['1', '2', '3'], // Example jurisdictions
        require_accreditation: '0',
        commitment: commitment,
      };

      const proofResponse = await generateProof(proofRequest);

      if (!proofResponse.success) {
        throw new Error(proofResponse.error || 'Proof generation failed');
      }

      // In a real implementation, you would:
      // 1. Request attestation from attester service
      // 2. Register KYC on-chain using the SDK
      // 3. Show success message

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const generateCommitment = async (data: string, nonce: string): Promise<string> => {
    // Simplified commitment generation
    // In production, use proper cryptographic hash
    const combined = data + nonce;
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(combined);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  return (
    <form onSubmit={handleSubmit} className="kyc-form">
      <h2>Complete KYC Verification</h2>
      
      {error && <div className="error">{error}</div>}

      <div className="form-group">
        <label htmlFor="age">Age:</label>
        <input
          type="number"
          id="age"
          value={age}
          onChange={(e) => setAge(e.target.value)}
          required
          min="18"
        />
      </div>

      <div className="form-group">
        <label htmlFor="jurisdiction">Jurisdiction ID:</label>
        <input
          type="number"
          id="jurisdiction"
          value={jurisdiction}
          onChange={(e) => setJurisdiction(e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={isAccredited}
            onChange={(e) => setIsAccredited(e.target.checked)}
          />
          Accredited Investor
        </label>
      </div>

      <button type="submit" disabled={loading}>
        {loading ? 'Generating Proof...' : 'Submit KYC'}
      </button>
    </form>
  );
};

