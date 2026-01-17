import { useState } from 'react';
import { connectWallet, getUserSession, getUserAddress } from './lib/stacks';
import { KYCForm } from './components/KYCForm';
import { Vault } from './components/Vault';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState<'kyc' | 'vault'>('vault');
  const session = getUserSession();
  const userAddress = getUserAddress();

  return (
    <div className="App">
      <header className="App-header">
        <h1>Noah-v2 Vault with KYC</h1>
        <p>Privacy-Preserving KYC on Stacks - Simple Vault Integration</p>
        
        {!session && (
          <button onClick={connectWallet} className="connect-button">
            Connect Wallet
          </button>
        )}
        
        {session && (
          <div className="user-info">
            <p>Connected: {userAddress}</p>
          </div>
        )}
      </header>

      <nav className="tabs">
        <button 
          onClick={() => setActiveTab('kyc')} 
          className={activeTab === 'kyc' ? 'active' : ''}
        >
          KYC Form
        </button>
        <button 
          onClick={() => setActiveTab('vault')} 
          className={activeTab === 'vault' ? 'active' : ''}
        >
          Vault
        </button>
      </nav>

      <main className="content">
        {activeTab === 'kyc' && <KYCForm />}
        {activeTab === 'vault' && <Vault />}
      </main>

      <footer>
        <p>Complete KYC verification to interact with the vault</p>
      </footer>
    </div>
  );
}

export default App;
