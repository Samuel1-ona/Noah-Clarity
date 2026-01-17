/**
 * Stacks wallet integration helpers
 */

import { AppConfig, showConnect, UserSession } from '@stacks/connect';
import { StacksTestnet, StacksMainnet } from '@stacks/network';

export const appConfig: AppConfig = {
  appName: 'Noah-v2 KYC Demo',
  appIcon: window.location.origin + '/logo.png',
  redirectPath: '/',
};

export function getNetwork() {
  const network = process.env.REACT_APP_NETWORK || 'testnet';
  return network === 'mainnet' ? new StacksMainnet() : new StacksTestnet();
}

export function connectWallet() {
  showConnect({
    appDetails: appConfig,
    onFinish: () => {
      window.location.reload();
    },
  });
}

export function getUserSession(): UserSession | null {
  const session = new UserSession({ appConfig });
  return session.isUserSignedIn() ? session : null;
}

export function getUserAddress(): string | null {
  const session = getUserSession();
  if (!session) return null;
  
  const userData = session.loadUserData();
  return userData.profile.stxAddress.testnet || userData.profile.stxAddress.mainnet;
}

