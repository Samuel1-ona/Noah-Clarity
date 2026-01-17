/**
 * Stacks wallet integration helpers
 */

import { AppConfig, showConnect, UserSession } from '@stacks/connect';
import { StacksTestnet, StacksMainnet } from '@stacks/network';

function getAppConfig(): AppConfig {
  return {
    appName: 'Noah-v2 Vault',
    appIcon: `${window.location.origin}/vite.svg`,
    redirectPath: '/',
  };
}

export function getNetwork() {
  const network = import.meta.env.VITE_NETWORK || 'testnet';
  return network === 'mainnet' ? new StacksMainnet() : new StacksTestnet();
}

export function connectWallet() {
  const appConfig = getAppConfig();
  showConnect({
    appDetails: {
      name: appConfig.appName,
      icon: appConfig.appIcon,
      redirectPath: appConfig.redirectPath,
    },
    onFinish: () => {
      window.location.reload();
    },
  });
}

export function getUserSession(): UserSession | null {
  const session = new UserSession({ appConfig: getAppConfig() });
  return session.isUserSignedIn() ? session : null;
}

export function getUserAddress(): string | null {
  const session = getUserSession();
  if (!session) return null;
  
  const userData = session.loadUserData();
  return userData.profile.stxAddress.testnet || userData.profile.stxAddress.mainnet;
}

