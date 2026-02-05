import React, { useState } from 'react';
import {
    Box,
    Typography,
    Paper,
    Button,
    CircularProgress,
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
            <Box sx={{ mb: 4, textAlign: 'center' }}>
                <Typography variant="h6" gutterBottom color="primary.main" sx={{ fontWeight: 700 }}>
                    1. Identity Verification
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400, mx: 'auto' }}>
                    Upload a high-quality photo of your passport. Data extraction is performed locally and securely.
                </Typography>
            </Box>

            {!preview ? (
                <Paper
                    variant="outlined"
                    sx={{
                        py: 8,
                        px: 3,
                        textAlign: 'center',
                        cursor: 'pointer',
                        borderStyle: 'dashed',
                        borderWidth: 2,
                        borderRadius: 4,
                        borderColor: error ? 'error.light' : 'primary.light',
                        bgcolor: 'background.paper',
                        background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)',
                        '&:hover': {
                            borderColor: 'secondary.main',
                            bgcolor: 'rgba(99, 102, 241, 0.02)',
                            transform: 'translateY(-2px)',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.08)',
                        },
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                    component="label"
                >
                    <input
                        type="file"
                        hidden
                        accept="image/*"
                        onChange={handleFileChange}
                    />
                    <Box
                        sx={{
                            width: 80,
                            height: 80,
                            borderRadius: '50%',
                            bgcolor: 'primary.50',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            mx: 'auto',
                            mb: 3,
                        }}
                    >
                        <CloudUploadIcon sx={{ fontSize: 40, color: 'secondary.main' }} />
                    </Box>
                    <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
                        Select Passport Image
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Drag and drop or click to browse
                        <Box component="span" sx={{ display: 'block', mt: 0.5, fontSize: '0.75rem', opacity: 0.8 }}>
                            Supports JPG, PNG (Max 5MB)
                        </Box>
                    </Typography>
                </Paper>
            ) : (
                <Fade in={!!preview}>
                    <Paper
                        elevation={0}
                        sx={{
                            p: 3,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            borderRadius: 4,
                            border: '1px solid',
                            borderColor: 'divider',
                            bgcolor: 'background.paper',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                            position: 'relative',
                            overflow: 'hidden',
                        }}
                    >
                        <Box
                            sx={{
                                width: '100%',
                                height: 300,
                                mb: 3,
                                borderRadius: 3,
                                overflow: 'hidden',
                                position: 'relative',
                                bgcolor: 'grey.50',
                                border: '1px solid',
                                borderColor: 'grey.200',
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

                            {/* Glassmorphism Overlay */}
                            {!loading && !success && (
                                <Box
                                    sx={{
                                        position: 'absolute',
                                        inset: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        opacity: 0,
                                        '&:hover': { opacity: 1 },
                                        transition: 'opacity 0.2s',
                                        bgcolor: 'rgba(15, 23, 42, 0.1)',
                                        backdropFilter: 'blur(2px)',
                                    }}
                                >
                                    <Button
                                        variant="contained"
                                        color="error"
                                        startIcon={<DeleteIcon />}
                                        onClick={handleRemove}
                                        sx={{ borderRadius: 10 }}
                                    >
                                        Remove
                                    </Button>
                                </Box>
                            )}
                        </Box>

                        <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', mb: 3, px: 1 }}>
                            <Box
                                sx={{
                                    p: 1,
                                    borderRadius: 1,
                                    bgcolor: 'primary.50',
                                    display: 'flex',
                                    mr: 2
                                }}
                            >
                                <ImageIcon sx={{ color: 'secondary.main', fontSize: 20 }} />
                            </Box>
                            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                                    {file?.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {(file!.size / 1024 / 1024).toFixed(2)} MB • Ready for verification
                                </Typography>
                            </Box>
                            {success && (
                                <Box sx={{ display: 'flex', alignItems: 'center', color: 'success.main' }}>
                                    <CheckCircleIcon sx={{ mr: 0.5 }} />
                                    <Typography variant="caption" sx={{ fontWeight: 'bold' }}>VERIFIED</Typography>
                                </Box>
                            )}
                        </Box>

                        <Button
                            variant="contained"
                            fullWidth
                            size="large"
                            onClick={handleUpload}
                            disabled={loading || success}
                            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <CloudUploadIcon />}
                            sx={{
                                py: 2,
                                borderRadius: 3,
                                background: success ? undefined : 'linear-gradient(90deg, #0F172A 0%, #334155 100%)',
                                '&:hover': {
                                    background: success ? undefined : 'linear-gradient(90deg, #1E293B 0%, #475569 100%)',
                                }
                            }}
                        >
                            {loading ? 'Verifying Integrity...' : success ? 'Successfully Verified' : 'Confirm & Verify Document'}
                        </Button>

                        {!loading && !success && (
                            <Button
                                variant="text"
                                size="small"
                                onClick={handleRemove}
                                sx={{ mt: 2, color: 'text.secondary' }}
                            >
                                Change Selection
                            </Button>
                        )}
                    </Paper>
                </Fade>
            )}

            {error && (
                <Alert
                    severity="error"
                    variant="filled"
                    sx={{ mt: 3, borderRadius: 3 }}
                    onClose={() => setError(null)}
                >
                    {error}
                </Alert>
            )}
        </Box>
    );
};
