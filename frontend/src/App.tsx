import React, { useState } from 'react';
import { connectWallet, getUserSession, getUserAddress } from './lib/stacks';
import { KYCForm } from './components/KYCForm';
import { StatusChecker } from './components/StatusChecker';
import { ProofGenerator } from './components/ProofGenerator';
import { ProtocolExample } from './components/ProtocolExample';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState<'kyc' | 'status' | 'proof' | 'protocol'>('kyc');
  const session = getUserSession();
  const userAddress = getUserAddress();

  return (
    <div className="App">
      <header className="App-header">
        <h1>Noah-v2 KYC Demo</h1>
        <p>Privacy-Preserving KYC on Stacks</p>
        
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
          onClick={() => setActiveTab('status')} 
          className={activeTab === 'status' ? 'active' : ''}
        >
          Status Check
        </button>
        <button 
          onClick={() => setActiveTab('proof')} 
          className={activeTab === 'proof' ? 'active' : ''}
        >
          Proof Generator
        </button>
        <button 
          onClick={() => setActiveTab('protocol')} 
          className={activeTab === 'protocol' ? 'active' : ''}
        >
          Protocol Example
        </button>
      </nav>

      <main className="content">
        {activeTab === 'kyc' && <KYCForm />}
        {activeTab === 'status' && <StatusChecker />}
        {activeTab === 'proof' && <ProofGenerator />}
        {activeTab === 'protocol' && <ProtocolExample />}
      </main>

      <footer>
        <p>This is a demo application showing SDK usage patterns</p>
      </footer>
    </div>
  );
}

export default App;

