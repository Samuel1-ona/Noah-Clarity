import React, { useState } from 'react';
import {
    Box,
    Typography,
    Paper,
    Button,
    CircularProgress,
    IconButton,
    Alert,
    Fade,
} from '@mui/material';
import {
    CloudUpload as CloudUploadIcon,
    Delete as DeleteIcon,
    CheckCircle as CheckCircleIcon,
    Image as ImageIcon,
} from '@mui/icons-material';
import { verifyPassport } from '../lib/kyc';

interface DocumentUploadProps {
    onVerified: (data: any) => void;
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({ onVerified }) => {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (selectedFile) {
            if (selectedFile.size > 5 * 1024 * 1024) {
                setError('File size too large. Please upload an image smaller than 5MB.');
                return;
            }
            setFile(selectedFile);
            setPreview(URL.createObjectURL(selectedFile));
            setError(null);
            setSuccess(false);
        }
    };

    const handleRemove = () => {
        setFile(null);
        setPreview(null);
        setSuccess(false);
    };

    const handleUpload = async () => {
        if (!file) return;

        setLoading(true);
        setError(null);

        try {
            const result = await verifyPassport(file);
            if (result.success) {
                setSuccess(true);
                setTimeout(() => {
                    onVerified(result.data);
                }, 1500);
            } else {
                setError(result.error || 'Failed to verify document. Please try again with a clearer image.');
            }
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ width: '100%', mt: 2 }}>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
                Step 1: Upload Identity Document
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Please upload a clear photo of your passport. Our OCR system will extract your information securely.
            </Typography>

            {!preview ? (
                <Paper
                    variant="outlined"
                    sx={{
                        py: 6,
                        px: 2,
                        textAlign: 'center',
                        cursor: 'pointer',
                        borderStyle: 'dashed',
                        borderWidth: 2,
                        borderColor: error ? 'error.main' : 'primary.main',
                        bgcolor: 'grey.50',
                        '&:hover': {
                            bgcolor: 'primary.50',
                            borderColor: 'primary.dark',
                        },
                        transition: 'all 0.2s ease-in-out',
                    }}
                    component="label"
                >
                    <input
                        type="file"
                        hidden
                        accept="image/*"
                        onChange={handleFileChange}
                    />
                    <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                    <Typography variant="h6">Click or Drag Passport Image</Typography>
                    <Typography variant="body2" color="text.secondary">
                        PNG, JPG or JPEG (max. 5MB)
                    </Typography>
                </Paper>
            ) : (
                <Fade in={!!preview}>
                    <Paper
                        variant="outlined"
                        sx={{
                            p: 2,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            bgcolor: 'background.paper',
                        }}
                    >
                        <Box
                            sx={{
                                width: '100%',
                                height: 250,
                                mb: 2,
                                borderRadius: 1,
                                overflow: 'hidden',
                                position: 'relative',
                                bgcolor: 'grey.100',
                            }}
                        >
                            <img
                                src={preview}
                                alt="Passport Preview"
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'contain',
                                }}
                            />
                            <IconButton
                                sx={{
                                    position: 'absolute',
                                    top: 8,
                                    right: 8,
                                    bgcolor: 'rgba(255,255,255,0.8)',
                                    '&:hover': { bgcolor: 'white' },
                                }}
                                onClick={handleRemove}
                                disabled={loading}
                            >
                                <DeleteIcon color="error" />
                            </IconButton>
                        </Box>

                        <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', mb: 1 }}>
                            <ImageIcon sx={{ color: 'primary.main', mr: 1 }} />
                            <Typography variant="body2" noWrap sx={{ flexGrow: 1 }}>
                                {file?.name}
                            </Typography>
                            {success && <CheckCircleIcon color="success" sx={{ ml: 1 }} />}
                        </Box>

                        <Button
                            variant="contained"
                            fullWidth
                            size="large"
                            onClick={handleUpload}
                            disabled={loading || success}
                            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <CloudUploadIcon />}
                            sx={{ mt: 1, py: 1.5, fontWeight: 'bold' }}
                        >
                            {loading ? 'Verifying...' : success ? 'Verified!' : 'Verify Document'}
                        </Button>
                    </Paper>
                </Fade>
            )}

            {error && (
                <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}
        </Box>
    );
};
