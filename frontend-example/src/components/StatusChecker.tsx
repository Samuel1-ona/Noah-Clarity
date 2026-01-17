import React, { useState, useEffect } from 'react';
import { checkKYCStatus, isKYCValid } from '../lib/kyc';
import { getUserAddress } from '../lib/stacks';

export const StatusChecker: React.FC = () => {
  const [status, setStatus] = useState<{
    hasKYC: boolean;
    isValid: boolean;
    loading: boolean;
    error: string | null;
  }>({
    hasKYC: false,
    isValid: false,
    loading: false,
    error: null,
  });

  const checkStatus = async () => {
    const userAddress = getUserAddress();
    if (!userAddress) {
      setStatus({
        hasKYC: false,
        isValid: false,
        loading: false,
        error: 'Please connect your wallet',
      });
      return;
    }

    setStatus(prev => ({ ...prev, loading: true, error: null }));

    try {
      const kycStatus = await checkKYCStatus(userAddress);
      const isValid = await isKYCValid(userAddress);

      setStatus({
        hasKYC: kycStatus.hasKYC,
        isValid,
        loading: false,
        error: null,
      });
    } catch (err: any) {
      setStatus({
        hasKYC: false,
        isValid: false,
        loading: false,
        error: err.message || 'Failed to check status',
      });
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  return (
    <div className="status-checker">
      <h2>KYC Status</h2>
      
      {status.loading && <div>Checking status...</div>}
      
      {status.error && <div className="error">{status.error}</div>}
      
      {!status.loading && !status.error && (
        <div>
          <p>Has KYC: {status.hasKYC ? 'Yes' : 'No'}</p>
          <p>Valid: {status.isValid ? 'Yes' : 'No'}</p>
        </div>
      )}

      <button onClick={checkStatus} disabled={status.loading}>
        Refresh Status
      </button>
    </div>
  );
};

