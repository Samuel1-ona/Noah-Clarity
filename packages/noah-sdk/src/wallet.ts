/**
 * Wallet integration helpers
 */

import { AppConfig, UserSession } from '@stacks/connect';

export interface WalletConfig {
  appName: string;
  appIcon?: string;
  redirectPath?: string;
}

export class WalletHelper {
  private config: WalletConfig;

  constructor(config: WalletConfig) {
    this.config = config;
  }

  /**
   * Get Stacks Connect app configuration
   */
  getAppConfig(): AppConfig {
    return {
      appName: this.config.appName,
      appIcon: this.config.appIcon || window.location.origin + '/logo.png',
      redirectPath: this.config.redirectPath || '/',
    };
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(session: UserSession | null): boolean {
    return session !== null && session.isUserSignedIn();
  }

  /**
   * Get user's Stacks address from session
   */
  getUserAddress(session: UserSession | null): string | null {
    if (!this.isAuthenticated(session)) {
      return null;
    }
    return session.loadUserData().profile.stxAddress.mainnet || session.loadUserData().profile.stxAddress.testnet;
  }
}

