import React, { useState, useEffect } from 'react';
import { getUserSession, getUserAddress, getNetwork } from '../lib/stacks';
import { isKYCValid } from '../lib/kyc';
import { 
  uintCV,
  principalCV,
  cvToJSON,
  callReadOnlyFunction
} from '@stacks/transactions';
import { openContractCall } from '@stacks/connect';

const VAULT_CONTRACT = 'STVAH96MR73TP2FZG2W4X220MEB4NEMJHPMVYQNS.simple-vault';

interface VaultState {
  balance: string;
  kycStatus: boolean;
  loading: boolean;
  error: string | null;
  depositing: boolean;
  withdrawing: boolean;
}

export const Vault: React.FC = () => {
  const session = getUserSession();
  const userAddress = getUserAddress();
  const [vaultState, setVaultState] = useState<VaultState>({
    balance: '0',
    kycStatus: false,
    loading: true,
    error: null,
    depositing: false,
    withdrawing: false,
  });
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  // Initialize SDK and check KYC status
  useEffect(() => {
    const checkKYCAndBalance = async () => {
      if (!userAddress) {
        setVaultState(prev => ({ ...prev, loading: false }));
        return;
      }

      try {
        // Check KYC status using the kyc lib
        const kycStatus = await isKYCValid(userAddress);

        // Check vault balance
        const balance = await getVaultBalance(userAddress);

        setVaultState(prev => ({
          ...prev,
          kycStatus,
          balance,
          loading: false,
        }));
      } catch (error) {
        console.error('Error checking status:', error);
        setVaultState(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to check status',
        }));
      }
    };

    checkKYCAndBalance();
  }, [userAddress]);

  const getVaultBalance = async (address: string): Promise<string> => {
    try {
      const [contractAddress, contractName] = VAULT_CONTRACT.split('.');
      const network = getNetwork();
      
      const result = await callReadOnlyFunction({
        contractAddress,
        contractName,
        functionName: 'get-balance',
        functionArgs: [principalCV(address)],
        network,
        senderAddress: contractAddress,
      });

      const jsonResult = cvToJSON(result);
      if (jsonResult.type === 'responseOk') {
        return jsonResult.value.value.toString();
      }
      return '0';
    } catch (error) {
      console.error('Error fetching balance:', error);
      return '0';
    }
  };

  const handleDeposit = async () => {
    if (!session || !userAddress) {
      setVaultState(prev => ({ ...prev, error: 'Please connect your wallet' }));
      return;
    }

    if (!vaultState.kycStatus) {
      setVaultState(prev => ({ ...prev, error: 'KYC verification required. Please complete KYC first.' }));
      return;
    }

    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      setVaultState(prev => ({ ...prev, error: 'Please enter a valid amount' }));
      return;
    }

    setVaultState(prev => ({ ...prev, depositing: true, error: null }));

    try {
      const [contractAddress, contractName] = VAULT_CONTRACT.split('.');
      const amountMicroStx = BigInt(Math.floor(amount * 1_000_000));

      await openContractCall({
        contractAddress,
        contractName,
        functionName: 'deposit',
        functionArgs: [uintCV(amountMicroStx.toString())],
        network: getNetwork(),
        onFinish: async (data) => {
          console.log('Deposit transaction sent:', data);
          setDepositAmount('');
          // Refresh balance after transaction
          setTimeout(async () => {
            const newBalance = await getVaultBalance(userAddress);
            setVaultState(prev => ({ ...prev, balance: newBalance, depositing: false }));
          }, 3000);
        },
        onCancel: () => {
          setVaultState(prev => ({ ...prev, depositing: false }));
        },
      });
    } catch (error) {
      console.error('Error depositing:', error);
      setVaultState(prev => ({
        ...prev,
        depositing: false,
        error: error instanceof Error ? error.message : 'Deposit failed',
      }));
    }
  };

  const handleWithdraw = async () => {
    if (!session || !userAddress) {
      setVaultState(prev => ({ ...prev, error: 'Please connect your wallet' }));
      return;
    }

    if (!vaultState.kycStatus) {
      setVaultState(prev => ({ ...prev, error: 'KYC verification required. Please complete KYC first.' }));
      return;
    }

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      setVaultState(prev => ({ ...prev, error: 'Please enter a valid amount' }));
      return;
    }

    setVaultState(prev => ({ ...prev, withdrawing: true, error: null }));

    try {
      const [contractAddress, contractName] = VAULT_CONTRACT.split('.');
      const amountMicroStx = BigInt(Math.floor(amount * 1_000_000));

      await openContractCall({
        contractAddress,
        contractName,
        functionName: 'withdraw',
        functionArgs: [uintCV(amountMicroStx.toString())],
        network: getNetwork(),
        onFinish: async (data) => {
          console.log('Withdraw transaction sent:', data);
          setWithdrawAmount('');
          // Refresh balance after transaction
          setTimeout(async () => {
            const newBalance = await getVaultBalance(userAddress);
            setVaultState(prev => ({ ...prev, balance: newBalance, withdrawing: false }));
          }, 3000);
        },
        onCancel: () => {
          setVaultState(prev => ({ ...prev, withdrawing: false }));
        },
      });
    } catch (error) {
      console.error('Error withdrawing:', error);
      setVaultState(prev => ({
        ...prev,
        withdrawing: false,
        error: error instanceof Error ? error.message : 'Withdraw failed',
      }));
    }
  };

  const formatBalance = (balance: string): string => {
    const balanceNum = BigInt(balance);
    const stx = Number(balanceNum) / 1_000_000;
    return stx.toFixed(6);
  };

  if (!session) {
    return (
      <div className="vault-container">
        <p>Please connect your wallet to use the vault.</p>
      </div>
    );
  }

  if (vaultState.loading) {
    return (
      <div className="vault-container">
        <p>Loading vault status...</p>
      </div>
    );
  }

  if (!vaultState.kycStatus) {
    return (
      <div className="vault-container">
        <div className="kyc-required">
          <h2>KYC Verification Required</h2>
          <p>You must complete KYC verification before you can use the vault.</p>
          <p>Please complete your KYC registration in the "KYC Form" tab first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="vault-container">
      <h2>Simple Vault</h2>
      
      {vaultState.error && (
        <div className="error-message" style={{ color: 'red', marginBottom: '1rem' }}>
          {vaultState.error}
        </div>
      )}

      <div className="balance-section">
        <h3>Your Balance</h3>
        <p className="balance-amount">{formatBalance(vaultState.balance)} STX</p>
      </div>

      <div className="vault-actions">
        <div className="deposit-section">
          <h3>Deposit STX</h3>
          <input
            type="number"
            placeholder="Amount (STX)"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            disabled={vaultState.depositing}
          />
          <button 
            onClick={handleDeposit}
            disabled={vaultState.depositing || !depositAmount}
          >
            {vaultState.depositing ? 'Depositing...' : 'Deposit'}
          </button>
        </div>

        <div className="withdraw-section">
          <h3>Withdraw STX</h3>
          <input
            type="number"
            placeholder="Amount (STX)"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            disabled={vaultState.withdrawing}
          />
          <button 
            onClick={handleWithdraw}
            disabled={vaultState.withdrawing || !withdrawAmount}
          >
            {vaultState.withdrawing ? 'Withdrawing...' : 'Withdraw'}
          </button>
        </div>
      </div>
    </div>
  );
};

