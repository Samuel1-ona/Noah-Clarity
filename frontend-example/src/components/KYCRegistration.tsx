import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Stepper,
  Step,
  StepLabel,
  Button,
  TextField,
  FormControlLabel,
  Checkbox,
  Typography,
  Alert,
  CircularProgress,
  Paper,
  Chip,
  Divider,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { getUserAddress } from '../lib/stacks';
import { getProtocolRequirements, JURISDICTION_NAMES } from '../config/protocolRequirements';
import { registerKYCWithProtocol } from '../lib/kyc';
import { addressToNumeric, generateNumericNonce } from '../lib/identity';
import type { ProtocolRequirements } from 'noah-clarity';

type Step = 'info' | 'generate' | 'attest' | 'register' | 'complete';

export const KYCRegistration: React.FC<{ onComplete?: () => void }> = ({ onComplete }) => {
  const [activeStep, setActiveStep] = useState<Step>('info');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [requirementsLoading, setRequirementsLoading] = useState(true);
  const [protocolRequirements, setProtocolRequirements] = useState<ProtocolRequirements>({
    min_age: 18,
    allowed_jurisdictions: [1, 2, 3],
    require_accreditation: false,
  });

  // Form data
  const [age, setAge] = useState('');
  const [jurisdiction, setJurisdiction] = useState('1');
  const [isAccredited, setIsAccredited] = useState(false);

  // Fetch protocol requirements
  useEffect(() => {
    const fetchRequirements = async () => {
      try {
        const reqs = await getProtocolRequirements('vault');
        setProtocolRequirements(reqs);
        if (reqs.allowed_jurisdictions.length > 0) {
          setJurisdiction(reqs.allowed_jurisdictions[0].toString());
        }
      } catch (err) {
        console.error('Failed to fetch requirements:', err);
      } finally {
        setRequirementsLoading(false);
      }
    };
    fetchRequirements();
  }, []);

  const steps = [
    { id: 'info', label: 'Enter Your Information' },
    { id: 'generate', label: 'Generate Privacy Proof' },
    { id: 'attest', label: 'Get Verification' },
    { id: 'register', label: 'Register On-Chain' },
    { id: 'complete', label: 'Complete' },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === activeStep);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const userAddress = getUserAddress();
    if (!userAddress) {
      setError('Please connect your wallet first');
      return;
    }

    // Validate form
    if (!age || !jurisdiction) {
      setError('Please fill in all required fields');
      return;
    }

    const ageNum = parseInt(age);
    if (isNaN(ageNum) || ageNum < protocolRequirements.min_age) {
      setError(`You must be at least ${protocolRequirements.min_age} years old`);
      return;
    }

    if (!protocolRequirements.allowed_jurisdictions.includes(parseInt(jurisdiction))) {
      setError(`Your jurisdiction is not allowed for this protocol`);
      return;
    }

    if (protocolRequirements.require_accreditation && !isAccredited) {
      setError('This protocol requires accredited investor status');
      return;
    }

    setLoading(true);
    setActiveStep('generate');

    try {
      // Step 1: Generate proof (this happens automatically in registerKYCWithProtocol)
      setActiveStep('generate');
      setSuccess('Generating your privacy-preserving proof...');

      // Step 2: Get attestation (this also happens automatically)
      setActiveStep('attest');
      setSuccess('Verifying your proof with the KYC provider...');

      // Generate numeric nonce for commitment (must be numeric for big.Int)
      const nonce = generateNumericNonce();

      // User credential data
      // Convert address to numeric value for the ZK circuit
      const identityDataNumeric = addressToNumeric(userAddress);
      
      const userCredential = {
        age: ageNum.toString(),
        jurisdiction: jurisdiction,
        is_accredited: isAccredited ? '1' : '0',
        identity_data: identityDataNumeric,
        nonce: nonce,
      };

      // Step 3: Register on-chain (this includes proof generation and attestation)
      setActiveStep('register');
      setSuccess('Registering your KYC on the blockchain...');

      // Complete KYC registration flow (uses wallet extension, no private key needed)
      const txId = await registerKYCWithProtocol(
        userCredential,
        protocolRequirements
      );

      setActiveStep('complete');
      setSuccess(`KYC registered successfully! Transaction ID: ${txId}`);
      setLoading(false);

      // Call onComplete callback after a short delay to show success message
      if (onComplete) {
        setTimeout(() => {
          onComplete();
        }, 2000);
      }
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'An error occurred during registration');
      setActiveStep('info');
    }
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 'info':
        return (
          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
              Complete Your KYC Verification
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Your personal information is protected with zero-knowledge proofs. 
              We verify you meet the requirements without seeing your actual data.
            </Typography>

            <Paper elevation={0} sx={{ p: 2, mb: 3, bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.200' }}>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                Protocol Requirements
              </Typography>
              <Box sx={{ mt: 1 }}>
                <Chip size="small" label={`Minimum Age: ${protocolRequirements.min_age}+`} sx={{ mr: 1, mb: 1 }} />
                <Chip 
                  size="small" 
                  label={`Jurisdictions: ${protocolRequirements.allowed_jurisdictions.map(j => JURISDICTION_NAMES[j] || j).join(', ')}`} 
                  sx={{ mr: 1, mb: 1 }} 
                />
                {protocolRequirements.require_accreditation && (
                  <Chip size="small" label="Accredited Investor Required" color="warning" />
                )}
              </Box>
            </Paper>

            <TextField
              fullWidth
              label="Your Age"
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              required
              margin="normal"
              helperText={`Must be at least ${protocolRequirements.min_age} years old`}
            />

            <TextField
              fullWidth
              select
              label="Your Jurisdiction"
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value)}
              required
              margin="normal"
              disabled={requirementsLoading}
              SelectProps={{
                native: true,
              }}
            >
              {protocolRequirements.allowed_jurisdictions.map((j: number) => (
                <option key={j} value={j.toString()}>
                  {JURISDICTION_NAMES[j] || `Jurisdiction ${j}`}
                </option>
              ))}
            </TextField>

            <FormControlLabel
              control={
                <Checkbox
                  checked={isAccredited}
                  onChange={(e) => setIsAccredited(e.target.checked)}
                />
              }
              label="I am an accredited investor"
              sx={{ mt: 2, mb: 2 }}
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={loading}
              sx={{ mt: 3 }}
            >
              Start KYC Verification
            </Button>
          </Box>
        );

      case 'generate':
        return (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CircularProgress size={60} sx={{ mb: 3 }} />
            <Typography variant="h6" gutterBottom>
              Generating Your Privacy Proof
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Creating a zero-knowledge proof that you meet the requirements...
              <br />
              Your personal data remains private and is never shared.
            </Typography>
          </Box>
        );

      case 'attest':
        return (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CircularProgress size={60} sx={{ mb: 3 }} />
            <Typography variant="h6" gutterBottom>
              Getting Verification from KYC Provider
            </Typography>
            <Typography variant="body2" color="text.secondary">
              The KYC provider is verifying your proof and will sign your credential.
            </Typography>
          </Box>
        );

      case 'register':
        return (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CircularProgress size={60} sx={{ mb: 3 }} />
            <Typography variant="h6" gutterBottom>
              Registering on Blockchain
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Registering your verified KYC credential on the Stacks blockchain...
            </Typography>
          </Box>
        );

      case 'complete':
        return (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CheckCircleIcon sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              KYC Verification Complete!
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Your KYC credential is now registered on-chain. You can now access protocols that require KYC.
            </Typography>
            <Button
              variant="contained"
              onClick={() => {
                if (onComplete) onComplete();
              }}
            >
              Continue to Protocol
            </Button>
          </Box>
        );
    }
  };

  return (
    <Card sx={{ maxWidth: 800, mx: 'auto' }}>
      <CardContent>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
            KYC Registration
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Complete your Know Your Customer verification to access protocols
          </Typography>
        </Box>

        <Stepper activeStep={currentStepIndex} alternativeLabel sx={{ mb: 4 }}>
          {steps.map((step) => (
            <Step key={step.id}>
              <StepLabel>{step.label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Divider sx={{ mb: 3 }} />

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && !error && (
          <Alert severity="success" sx={{ mb: 3 }}>
            {success}
          </Alert>
        )}

        {renderStepContent()}
      </CardContent>
    </Card>
  );
};

