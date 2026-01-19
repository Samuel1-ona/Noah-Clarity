import { useState } from 'react';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { Container, AppBar, Toolbar, Typography, Tabs, Tab, Box, Button } from '@mui/material';
import { Wallet as WalletIcon, VerifiedUser as VerifiedUserIcon, AccountBalance as AccountBalanceIcon, PersonAdd as PersonAddIcon } from '@mui/icons-material';
import { connectWallet, getUserSession, getUserAddress, disconnectWallet } from './lib/stacks';
import { KYCRegistration } from './components/KYCRegistration';
import { Vault } from './components/Vault';
import { AttesterManagement } from './components/AttesterManagement';
import './App.css';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
  },
});

function App() {
  const [activeTab, setActiveTab] = useState<0 | 1 | 2>(0);
  const session = getUserSession();
  const userAddress = getUserAddress();

  const handleTabChange = (_event: React.SyntheticEvent, newValue: 0 | 1 | 2) => {
    setActiveTab(newValue);
  };

  const handleKYCComplete = () => {
    // Switch to vault tab when KYC is complete
    setActiveTab(1);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ flexGrow: 1, minHeight: '100vh', bgcolor: 'grey.50' }}>
        <AppBar position="static" elevation={0}>
          <Toolbar>
            <VerifiedUserIcon sx={{ mr: 2 }} />
            <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
              Noah-v2 KYC Demo
            </Typography>
            {!session && (
              <Button
                color="inherit"
                startIcon={<WalletIcon />}
                onClick={connectWallet}
                variant="outlined"
                sx={{ borderColor: 'white', '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' } }}
              >
                Connect Wallet
              </Button>
            )}
            {session && (
              <>
              <Typography variant="body2" sx={{ mr: 2 }}>
                {userAddress?.substring(0, 6)}...{userAddress?.substring(userAddress.length - 4)}
              </Typography>
                <Button
                  color="inherit"
                  onClick={disconnectWallet}
                  variant="outlined"
                  size="small"
                  sx={{ borderColor: 'white', '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' } }}
                >
                  Disconnect
                </Button>
              </>
            )}
          </Toolbar>
        </AppBar>

        <Container maxWidth="lg" sx={{ py: 4 }}>
          <Box sx={{ mb: 4, textAlign: 'center' }}>
            <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
              Privacy-Preserving KYC on Stacks
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Verify your identity with zero-knowledge proofs. Your personal data stays private.
            </Typography>
          </Box>

          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 4 }}>
            <Tabs value={activeTab} onChange={handleTabChange} aria-label="navigation tabs" centered>
              <Tab 
                icon={<VerifiedUserIcon />} 
                iconPosition="start"
                label="KYC Registration" 
                sx={{ minHeight: 72, textTransform: 'none', fontSize: '1rem' }}
              />
              <Tab 
                icon={<AccountBalanceIcon />} 
                iconPosition="start"
                label="Secure Vault" 
                sx={{ minHeight: 72, textTransform: 'none', fontSize: '1rem' }}
              />
              <Tab 
                icon={<PersonAddIcon />} 
                iconPosition="start"
                label="Attester Management" 
                sx={{ minHeight: 72, textTransform: 'none', fontSize: '1rem' }}
              />
            </Tabs>
          </Box>

          <Box>
            {activeTab === 0 && <KYCRegistration onComplete={handleKYCComplete} />}
            {activeTab === 1 && <Vault />}
            {activeTab === 2 && <AttesterManagement />}
          </Box>
        </Container>

        <Box
          component="footer"
          sx={{
            py: 3,
            px: 2,
            mt: 'auto',
            bgcolor: 'background.paper',
            borderTop: 1,
            borderColor: 'divider',
            textAlign: 'center',
          }}
        >
          <Typography variant="body2" color="text.secondary">
            Complete KYC verification to interact with protocols. Your privacy is protected with zero-knowledge proofs.
          </Typography>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
