import { StorageInterface } from './types';

/**
 * Manager for handling blinding factors (nonces) securely and persistently
 */
export class BlindingManager {
    private storage: StorageInterface;
    private STORAGE_KEY_PREFIX = 'blinding_';

    constructor(storage: StorageInterface) {
        this.storage = storage;
    }

    /**
     * Get or generate a nonce for a specific user address
     */
    async getOrCreateNonce(userAddress: string): Promise<string> {
        const key = this.STORAGE_KEY_PREFIX + userAddress;
        let nonce = await this.storage.getItem(key);

        if (!nonce) {
            nonce = this.generateNonce();
            await this.storage.setItem(key, nonce);
        }

        return nonce;
    }

    /**
     * Explicitly set a nonce (e.g., during recovery)
     */
    async setNonce(userAddress: string, nonce: string): Promise<void> {
        const key = this.STORAGE_KEY_PREFIX + userAddress;
        await this.storage.setItem(key, nonce);
    }

    /**
     * Remove a nonce (use with caution)
     */
    async clearNonce(userAddress: string): Promise<void> {
        const key = this.STORAGE_KEY_PREFIX + userAddress;
        await this.storage.removeItem(key);
    }

    /**
     * Internal helper to generate high-entropy nonce
     */
    private generateNonce(): string {
        // If uuid is not available, we can use crypto.getRandomValues
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
            const array = new Uint8Array(32);
            crypto.getRandomValues(array);
            return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
        }
        // Fallback for non-browser environments (basic)
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
}
