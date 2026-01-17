/**
 * Wallet integration helpers
 */

import { UserSession } from '@stacks/connect';
import { WalletConfig } from './types';

export class WalletHelper {
  private config: WalletConfig;

  constructor(config: WalletConfig) {
    this.config = config;
  }

  /**
   * Get app name
   */
  getAppName(): string {
    return this.config.appName;
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
    const userData = session!.loadUserData();
    return userData.profile.stxAddress.mainnet || userData.profile.stxAddress.testnet;
  }
}

