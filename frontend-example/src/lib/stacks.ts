/**
 * Stacks wallet integration helpers
 */

import { showConnect, UserSession } from '@stacks/connect';
import { StacksTestnet, StacksMainnet } from '@stacks/network';

export function getNetwork() {
  const network = import.meta.env.VITE_NETWORK || 'testnet';
  return network === 'mainnet' ? new StacksMainnet() : new StacksTestnet();
}

export function connectWallet() {
  showConnect({
    appDetails: {
      name: 'Noah-v2 Vault',
      icon: `${window.location.origin}/vite.svg`,
    },
    onFinish: () => {
      window.location.reload();
    },
  });
}

export function getUserSession(): UserSession | null {
  const session = new UserSession({});
  return session.isUserSignedIn() ? session : null;
}

export function getUserAddress(): string | null {
  const session = getUserSession();
  if (!session) return null;
  
  const userData = session.loadUserData();
  return userData.profile.stxAddress.testnet || userData.profile.stxAddress.mainnet;
}

export function disconnectWallet() {
  const session = new UserSession({});
  if (session.isUserSignedIn()) {
    session.signUserOut();
    window.location.reload();
  }
}

/**
 * Get the app private key from the user session
 * This is used for signing transactions
 */
export function getAppPrivateKey(): string | null {
  const session = getUserSession();
  if (!session) return null;
  
  try {
    const userData = session.loadUserData();
    return userData.appPrivateKey;
  } catch (error) {
    console.error('Error getting app private key:', error);
    return null;
  }
}

