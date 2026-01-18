import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Button,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  Paper,
  Chip,
  Divider,
  Grid,
} from '@mui/material';
import {
  AccountBalance as AccountBalanceIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { getUserSession, getUserAddress, getNetwork } from '../lib/stacks';
import { isKYCValid } from '../lib/kyc';
import { getProtocolRequirements, JURISDICTION_NAMES } from '../config/protocolRequirements';
import type { ProtocolRequirements } from 'noah-clarity';
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
  const [protocolRequirements, setProtocolRequirements] = useState<ProtocolRequirements>({
    min_age: 18,
    allowed_jurisdictions: [1, 2, 3],
    require_accreditation: false,
  });

  // Fetch protocol requirements
  useEffect(() => {
    const fetchRequirements = async () => {
      try {
        const reqs = await getProtocolRequirements('vault');
        setProtocolRequirements(reqs);
      } catch (err) {
        console.error('Failed to fetch requirements:', err);
      }
    };
    fetchRequirements();
  }, []);

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
      <Card sx={{ maxWidth: 600, mx: 'auto' }}>
        <CardContent sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="h6" gutterBottom>
            Connect Your Wallet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Please connect your Stacks wallet to use the vault.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  if (vaultState.loading) {
    return (
      <Card sx={{ maxWidth: 600, mx: 'auto' }}>
        <CardContent sx={{ textAlign: 'center', py: 4 }}>
          <CircularProgress />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Loading vault status...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  if (!vaultState.kycStatus) {
    return (
      <Card sx={{ maxWidth: 600, mx: 'auto' }}>
        <CardContent>
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <WarningIcon sx={{ fontSize: 60, color: 'warning.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              KYC Verification Required
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              You must complete KYC verification before you can use the vault.
            </Typography>
            <Paper elevation={0} sx={{ p: 2, mb: 3, bgcolor: 'grey.50', textAlign: 'left' }}>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                This Protocol Requires:
              </Typography>
              <Box sx={{ mt: 1 }}>
                <Chip size="small" label={`Age: ${protocolRequirements.min_age}+`} sx={{ mr: 1, mb: 1 }} />
                <Chip 
                  size="small" 
                  label={`Jurisdictions: ${protocolRequirements.allowed_jurisdictions.map(j => JURISDICTION_NAMES[j] || j).join(', ')}`} 
                  sx={{ mr: 1, mb: 1 }} 
                />
                {protocolRequirements.require_accreditation && (
                  <Chip size="small" label="Accredited Investor" color="warning" />
                )}
              </Box>
            </Paper>
            <Typography variant="body2" color="text.secondary">
              Please complete your KYC registration in the "KYC Registration" tab first.
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ maxWidth: 800, mx: 'auto' }}>
      <CardContent>
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
          <AccountBalanceIcon color="primary" />
          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
            Secure Vault
          </Typography>
          <Chip 
            icon={<CheckCircleIcon />} 
            label="KYC Verified" 
            color="success" 
            size="small" 
            sx={{ ml: 'auto' }} 
          />
        </Box>

        {vaultState.error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setVaultState(prev => ({ ...prev, error: null }))}>
            {vaultState.error}
          </Alert>
        )}

        <Paper elevation={0} sx={{ p: 3, mb: 3, bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.200' }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Your Balance
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
            {formatBalance(vaultState.balance)} STX
          </Typography>
        </Paper>

        <Divider sx={{ my: 3 }} />

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper elevation={2} sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <ArrowUpwardIcon color="success" sx={{ mr: 1 }} />
                <Typography variant="h6">Deposit STX</Typography>
              </Box>
              <TextField
                fullWidth
                label="Amount (STX)"
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                disabled={vaultState.depositing}
                margin="normal"
                InputProps={{
                  inputProps: { min: 0, step: 0.000001 }
                }}
              />
              <Button
                fullWidth
                variant="contained"
                color="success"
                onClick={handleDeposit}
                disabled={vaultState.depositing || !depositAmount}
                sx={{ mt: 2 }}
                startIcon={vaultState.depositing ? <CircularProgress size={20} /> : <ArrowUpwardIcon />}
              >
                {vaultState.depositing ? 'Depositing...' : 'Deposit'}
              </Button>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper elevation={2} sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <ArrowDownwardIcon color="error" sx={{ mr: 1 }} />
                <Typography variant="h6">Withdraw STX</Typography>
              </Box>
              <TextField
                fullWidth
                label="Amount (STX)"
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                disabled={vaultState.withdrawing}
                margin="normal"
                InputProps={{
                  inputProps: { min: 0, step: 0.000001, max: parseFloat(formatBalance(vaultState.balance)) }
                }}
              />
              <Button
                fullWidth
                variant="contained"
                color="error"
                onClick={handleWithdraw}
                disabled={vaultState.withdrawing || !withdrawAmount}
                sx={{ mt: 2 }}
                startIcon={vaultState.withdrawing ? <CircularProgress size={20} /> : <ArrowDownwardIcon />}
              >
                {vaultState.withdrawing ? 'Withdrawing...' : 'Withdraw'}
              </Button>
            </Paper>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};
