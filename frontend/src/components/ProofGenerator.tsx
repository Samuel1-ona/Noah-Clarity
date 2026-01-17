import React, { useState } from 'react';
import { generateProof, ProofRequest } from '../lib/proof';

export const ProofGenerator: React.FC = () => {
  const [proofRequest, setProofRequest] = useState<Partial<ProofRequest>>({
    age: '25',
    jurisdiction: '1',
    is_accredited: '1',
    identity_data: '',
    nonce: '',
    min_age: '18',
    allowed_jurisdictions: ['1', '2', '3'],
    require_accreditation: '0',
    commitment: '',
  });
  const [proof, setProof] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    try {
      // Generate nonce if not provided
      if (!proofRequest.nonce) {
        proofRequest.nonce = Math.random().toString(36).substring(7);
      }

      // Generate commitment if not provided
      if (!proofRequest.commitment) {
        const data = proofRequest.identity_data || 'default';
        const combined = data + proofRequest.nonce;
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(combined);
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        proofRequest.commitment = '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      }

      const response = await generateProof(proofRequest as ProofRequest);
      
      if (response.success) {
        setProof(JSON.stringify(response, null, 2));
      } else {
        throw new Error(response.error || 'Proof generation failed');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="proof-generator">
      <h2>Generate ZK Proof</h2>
      
      <div className="form-group">
        <label>Age:</label>
        <input
          type="number"
          value={proofRequest.age}
          onChange={(e) => setProofRequest({ ...proofRequest, age: e.target.value })}
        />
      </div>

      <div className="form-group">
        <label>Jurisdiction:</label>
        <input
          type="number"
          value={proofRequest.jurisdiction}
          onChange={(e) => setProofRequest({ ...proofRequest, jurisdiction: e.target.value })}
        />
      </div>

      <div className="form-group">
        <label>Identity Data:</label>
        <input
          type="text"
          value={proofRequest.identity_data}
          onChange={(e) => setProofRequest({ ...proofRequest, identity_data: e.target.value })}
        />
      </div>

      <button onClick={handleGenerate} disabled={loading}>
        {loading ? 'Generating...' : 'Generate Proof'}
      </button>

      {error && <div className="error">{error}</div>}
      
      {proof && (
        <div className="proof-result">
          <h3>Proof:</h3>
          <pre>{proof}</pre>
        </div>
      )}
    </div>
  );
};

