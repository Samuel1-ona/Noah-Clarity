import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  Button,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  Paper,
  Divider,
  Grid,
} from '@mui/material';
import { openContractCall } from '@stacks/connect';
import { bufferCV, uintCV, standardPrincipalCV } from '@stacks/transactions';
import { getNetwork } from '../lib/stacks';

const ATTESTER_REGISTRY_CONTRACT = import.meta.env.VITE_ATTESTER_REGISTRY || 'ST2N04CYE3CQ1S354MZX4KHYJYD4QW25ZW37GQY7J.attester-registry';

export const AttesterManagement: React.FC = () => {
  const attesterServiceUrl = import.meta.env.VITE_ATTESTER_URL || 'http://localhost:8081';
  const [attesterId, setAttesterId] = useState<string>('1');
  const [publicKey, setPublicKey] = useState<string>('');
  const [attesterAddress, setAttesterAddress] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch attester info from backend service
  const fetchAttesterInfo = async () => {
    setLoadingInfo(true);
    setError(null);
    try {
      // First get the public key from backend
      const infoResponse = await fetch(`${attesterServiceUrl}/info`);
      if (!infoResponse.ok) {
        throw new Error('Failed to fetch attester info');
      }
      const infoData = await infoResponse.json();
      setPublicKey(infoData.public_key || '');

      // Then get the next available ID
      try {
        const idResponse = await fetch(`${attesterServiceUrl}/info/next-available-id`);
        if (idResponse.ok) {
          const idData = await idResponse.json();
          setAttesterId(idData.next_available_id?.toString() || infoData.attester_id?.toString() || '1');
        } else {
          // Fallback to backend's configured ID
          setAttesterId(infoData.attester_id?.toString() || '1');
        }
      } catch (idErr) {
        // Fallback to backend's configured ID if next-available-id fails
        setAttesterId(infoData.attester_id?.toString() || '1');
      }
    } catch (err: any) {
      setError(`Could not fetch attester info: ${err.message}. Please enter manually.`);
    } finally {
      setLoadingInfo(false);
    }
  };

  // Auto-fetch attester info on component mount
  useEffect(() => {
    fetchAttesterInfo();
  }, []);

  const handleRegisterAttester = async () => {
    setError(null);
    setSuccess(null);

    // Validate inputs
    if (!attesterId || !publicKey || !attesterAddress) {
      setError('Please provide Attester ID, Public Key, and Stacks Address');
      return;
    }

    const attesterIdNum = parseInt(attesterId, 10);
    if (isNaN(attesterIdNum) || attesterIdNum < 1) {
      setError('Attester ID must be a positive integer');
      return;
    }

    // Validate public key format (should be 66 hex chars = 33 bytes)
    const publicKeyHex = publicKey.replace('0x', '');
    if (publicKeyHex.length !== 66) {
      setError('Public key must be 66 hex characters (33 bytes, compressed secp256k1)');
      return;
    }

    // Parse contract address
    const parts = ATTESTER_REGISTRY_CONTRACT.split('.');
    if (parts.length !== 2) {
      setError(`Invalid contract address format: ${ATTESTER_REGISTRY_CONTRACT}`);
      return;
    }
    const contractAddress = parts[0];
    const contractName = parts[1];

    setLoading(true);

    try {
      // Convert hex string to Buffer for bufferCV
      const publicKeyBuffer = Buffer.from(publicKeyHex, 'hex');
      if (publicKeyBuffer.length !== 33) {
        throw new Error('Invalid public key length after conversion');
      }

      // Use openContractCall to register attester
      await new Promise<void>((resolve, reject) => {
        openContractCall({
          contractAddress,
          contractName,
          functionName: 'add-attester',
          functionArgs: [
            bufferCV(publicKeyBuffer) as any,
            uintCV(attesterIdNum) as any,
            standardPrincipalCV(attesterAddress) as any,
          ],
          network: getNetwork(),
          onFinish: (data) => {
            setSuccess(`Attester registered successfully! Transaction ID: ${data.txId}`);
            setLoading(false);
            resolve();
          },
          onCancel: () => {
            setError('Transaction cancelled by user');
            setLoading(false);
            reject(new Error('Transaction cancelled'));
          },
        }).catch((error) => {
          setError(error.message || 'Failed to register attester');
          setLoading(false);
          reject(error);
        });
      });
    } catch (err: any) {
      setError(err.message || 'An error occurred while registering attester');
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4, mb: 4 }}>
      <Card
        elevation={0}
        sx={{
          borderRadius: 6,
          background: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.08)',
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden'
        }}
      >
        <Box sx={{ p: { xs: 3, md: 5 } }}>
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 800, color: 'primary.main' }}>
            Attester Management
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
            Register attesters on-chain. Only the contract owner can register new attesters.
            The attester must provide their compressed secp256k1 public key (33 bytes, 66 hex characters).
          </Typography>

          <Divider sx={{ mb: 4 }} />

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
              {success}
            </Alert>
          )}

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Attester info from service ({attesterServiceUrl})
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={fetchAttesterInfo}
                  disabled={loadingInfo || loading}
                >
                  {loadingInfo ? 'Loading...' : 'Refresh'}
                </Button>
              </Box>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Attester ID"
                value={attesterId}
                onChange={(e) => setAttesterId(e.target.value)}
                type="number"
                helperText="Unique identifier for the attester (positive integer)"
                disabled={loading}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Public Key (Compressed secp256k1)"
                value={publicKey}
                onChange={(e) => setPublicKey(e.target.value)}
                placeholder="0x02... or 02... (66 hex characters, 33 bytes)"
                helperText="Compressed secp256k1 public key: 66 hex characters (0x prefix optional)"
                disabled={loading}
                multiline
                rows={2}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Attester Stacks Address"
                value={attesterAddress}
                onChange={(e) => setAttesterAddress(e.target.value)}
                placeholder="ST..."
                helperText="The Stacks address this attester will use (for on-chain identity)"
                disabled={loading}
              />
            </Grid>

            <Grid item xs={12}>
              <Button
                variant="contained"
                fullWidth
                size="large"
                onClick={handleRegisterAttester}
                disabled={loading || !attesterId || !publicKey}
                sx={{
                  mt: 3,
                  py: 1.5,
                  borderRadius: 3,
                  background: 'linear-gradient(90deg, #6366F1 0%, #4F46E5 100%)',
                  '&:hover': {
                    background: 'linear-gradient(90deg, #4F46E5 0%, #4338CA 100%)',
                  }
                }}
              >
                {loading ? (
                  <>
                    <CircularProgress size={20} color="inherit" sx={{ mr: 1 }} />
                    Registering Attester...
                  </>
                ) : (
                  'Register Attester on Blockchain'
                )}
              </Button>
            </Grid>
          </Grid>

          <Paper
            elevation={0}
            sx={{
              mt: 5,
              p: 3,
              bgcolor: 'rgba(15, 23, 42, 0.02)',
              borderRadius: 4,
              border: '1px solid',
              borderColor: 'rgba(15, 23, 42, 0.05)'
            }}
          >
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 700, display: 'flex', alignItems: 'center' }}>
              <Box component="span" sx={{ p: 0.5, bgcolor: 'primary.main', borderRadius: 1, mr: 1 }} />
              Registration Instructions
            </Typography>
            <Typography variant="body2" component="div" color="text.secondary" sx={{ mt: 1 }}>
              <ol style={{ paddingLeft: 20, margin: 0 }}>
                <li>Get the public key from your attester service (check backend logs).</li>
                <li>Enter the attester ID (typically 1 for the first attester).</li>
                <li>Enter the public key (66 hex characters, 0x prefix optional).</li>
                <li>Click "Register Attester" and approve the transaction.</li>
                <li>Wait for confirmation (must be contract owner).</li>
              </ol>
            </Typography>
          </Paper>
        </Box>
      </Card>
    </Box>
  );
};

