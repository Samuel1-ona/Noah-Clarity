import React, { useState } from 'react';
import { checkKYCStatus, isKYCValid } from '../lib/kyc';
import { getUserAddress } from '../lib/stacks';

/**
 * Example protocol integration component
 * Demonstrates how protocols would check KYC before allowing actions
 */
export const ProtocolExample: React.FC = () => {
  const [action, setAction] = useState<'deposit' | 'vote' | null>(null);
  const [kycChecked, setKycChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkKYC = async () => {
    const userAddress = getUserAddress();
    if (!userAddress) {
      setError('Please connect your wallet');
      return;
    }

    try {
      const isValid = await isKYCValid(userAddress);
      if (!isValid) {
        setError('KYC required to perform this action');
        return;
      }

      setKycChecked(true);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to check KYC');
    }
  };

  const handleAction = async (actionType: 'deposit' | 'vote') => {
    setAction(actionType);
    setKycChecked(false);
    setError(null);

    await checkKYC();
  };

  return (
    <div className="protocol-example">
      <h2>Example Protocol Integration</h2>
      <p>This demonstrates how protocols check KYC before allowing actions.</p>

      <div className="actions">
        <button onClick={() => handleAction('deposit')}>
          Simulate Deposit (Requires KYC)
        </button>
        <button onClick={() => handleAction('vote')}>
          Simulate Vote (Requires KYC)
        </button>
      </div>

      {action && (
        <div className="action-result">
          <h3>Action: {action}</h3>
          {error && <div className="error">{error}</div>}
          {kycChecked && !error && (
            <div className="success">
              KYC verified! Action would be allowed.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

