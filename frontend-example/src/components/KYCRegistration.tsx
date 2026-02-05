import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
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
  Fade,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { getUserAddress } from '../lib/stacks';
import { getProtocolRequirements, JURISDICTION_NAMES } from '../config/protocolRequirements';
import { registerKYCWithProtocol } from '../lib/kyc';
import { addressToNumeric, generateNumericNonce } from '../lib/identity';
import { DocumentUpload } from './DocumentUpload';
import type { ProtocolRequirements } from 'noah-clarity';

type Step = 'document' | 'info' | 'generate' | 'attest' | 'register' | 'complete';

export const KYCRegistration: React.FC<{ onComplete?: () => void }> = ({ onComplete }) => {
  const [activeStep, setActiveStep] = useState<Step>('document');
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
  const [documentInfo, setDocumentInfo] = useState<{
    type: string;
    number: string;
    country: string;
    date_of_birth: string;
    expiry_date: string;
    age: number;
  } | null>(null);

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
    { id: 'document', label: 'Verify Document' },
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

    // Only check jurisdiction if there is a restrictive list
    if (protocolRequirements.allowed_jurisdictions.length > 0 &&
      !protocolRequirements.allowed_jurisdictions.includes(parseInt(jurisdiction))) {
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
      if (!documentInfo) throw new Error('Document info is missing');

      const txId = await registerKYCWithProtocol(
        userAddress,
        userCredential,
        protocolRequirements,
        documentInfo
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
      case 'document':
        return (
          <DocumentUpload
            onVerified={(data) => {
              setDocumentInfo({
                type: 'Passport',
                ...data
              });
              setSuccess('Passport verified successfully! We have pre-filled some information for you.');

              // Auto-populate age
              if (data.age) {
                setAge(data.age.toString());
              }

              // Pre-fill jurisdiction if country is found
              // Now we map NGA -> 6, etc.
              if (data.country === 'USA') setJurisdiction('1');
              else if (data.country === 'GBR') setJurisdiction('2');
              else if (data.country === 'CAN') setJurisdiction('3');
              else if (data.country === 'NGA') {
                // Even if requirements are empty, we want to select the correct ID
                setJurisdiction('6');
              }

              setActiveStep('info');
            }}
          />
        );

      case 'info':
        // Determine available jurisdictions to show
        // If allowed list is empty, show all known jurisdictions
        const availableJurisdictions = protocolRequirements.allowed_jurisdictions.length > 0
          ? protocolRequirements.allowed_jurisdictions
          : Object.keys(JURISDICTION_NAMES).map(k => parseInt(k));

        return (
          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
              Complete Your KYC Verification
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Your personal information is protected with zero-knowledge proofs.
              We verify you meet the requirements without seeing your actual data.
            </Typography>

            <Paper
              elevation={0}
              sx={{
                p: 3,
                mb: 4,
                bgcolor: 'rgba(99, 102, 241, 0.04)',
                border: '1px solid',
                borderColor: 'rgba(99, 102, 241, 0.1)',
                borderRadius: 4,
              }}
            >
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 700, mb: 2 }}>
                Verified Identity Information
              </Typography>
              {documentInfo && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Box component="span" sx={{ fontWeight: 600 }}>Document No:</Box>
                    <Box component="span">{documentInfo.number}</Box>
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Box component="span" sx={{ fontWeight: 600 }}>Country:</Box>
                    <Box component="span">{documentInfo.country}</Box>
                  </Typography>
                  {documentInfo.age > 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Box component="span" sx={{ fontWeight: 600 }}>Verified Age:</Box>
                      <Box component="span">{documentInfo.age}</Box>
                    </Typography>
                  )}
                </Box>
              )}

              {(protocolRequirements.allowed_jurisdictions.length > 0 || protocolRequirements.min_age > 10) && (
                <>
                  <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 700, mt: 2, mb: 1 }}>
                    Protocol Requirements
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {protocolRequirements.min_age > 0 && (
                      <Chip
                        size="small"
                        label={`Age: ${protocolRequirements.min_age}+`}
                        sx={{ fontWeight: 600, bgcolor: 'white', border: '1px solid', borderColor: 'divider' }}
                      />
                    )}
                    {protocolRequirements.allowed_jurisdictions.length > 0 && (
                      <Chip
                        size="small"
                        label={`Jurisdictions: ${protocolRequirements.allowed_jurisdictions.map(j => JURISDICTION_NAMES[j] || j).join(', ')}`}
                        sx={{ fontWeight: 600, bgcolor: 'white', border: '1px solid', borderColor: 'divider' }}
                      />
                    )}
                    {protocolRequirements.require_accreditation && (
                      <Chip
                        size="small"
                        label="Accredited Required"
                        color="warning"
                        sx={{ fontWeight: 700 }}
                      />
                    )}
                  </Box>
                </>
              )}
            </Paper>

            <TextField
              fullWidth
              label="Your Age"
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              required
              margin="normal"
              helperText={protocolRequirements.min_age > 0 ? `Must be at least ${protocolRequirements.min_age} years old` : ''}
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
              {availableJurisdictions.map((j: number) => (
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
    <Card
      elevation={0}
      sx={{
        maxWidth: 800,
        mx: 'auto',
        borderRadius: 6,
        overflow: 'hidden',
        background: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.08)',
      }}
    >
      <Box sx={{ p: { xs: 3, md: 5 } }}>
        <Box sx={{ mb: 5, textAlign: 'center' }}>
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 800, color: 'primary.main' }}>
            KYC Verification
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Secure, private, and powered by zero-knowledge proofs.
          </Typography>
        </Box>

        <Stepper
          activeStep={currentStepIndex}
          alternativeLabel
          sx={{
            mb: 5,
            '& .MuiStepLabel-label': {
              fontWeight: 600,
              fontSize: '0.75rem',
              color: 'text.secondary',
            },
            '& .MuiStepLabel-label.Mui-active': {
              color: 'primary.main',
              fontWeight: 700,
            },
            '& .MuiStepIcon-root.Mui-active': {
              color: 'secondary.main',
            },
            '& .MuiStepIcon-root.Mui-completed': {
              color: 'success.main',
            }
          }}
        >
          {steps.map((step) => (
            <Step key={step.id}>
              <StepLabel>{step.label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Fade in={!!error}>
            <Alert
              severity="error"
              variant="filled"
              sx={{ mb: 4, borderRadius: 3 }}
              onClose={() => setError(null)}
            >
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{error}</Typography>
            </Alert>
          </Fade>
        )}

        {success && !error && activeStep !== 'complete' && (
          <Fade in={!!success}>
            <Alert
              severity="success"
              variant="outlined"
              sx={{ mb: 4, borderRadius: 3, bgcolor: 'rgba(74, 222, 128, 0.05)', borderColor: 'success.light' }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{success}</Typography>
            </Alert>
          </Fade>
        )}

        <Box sx={{ minHeight: 400 }}>
          {renderStepContent()}
        </Box>
      </Box>
    </Card>
  );
};

