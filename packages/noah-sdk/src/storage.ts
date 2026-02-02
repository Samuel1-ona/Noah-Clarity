import { StorageInterface } from './types';

/**
 * Default browser-based storage implementation using localStorage
 */
export class BrowserStorage implements StorageInterface {
    private prefix: string;

    constructor(prefix = 'noah_sdk_') {
        this.prefix = prefix;
    }

    async getItem(key: string): Promise<string | null> {
        try {
            return localStorage.getItem(this.prefix + key);
        } catch (e) {
            console.warn('LocalStorage access failed:', e);
            return null;
        }
    }

    async setItem(key: string, value: string): Promise<void> {
        try {
            localStorage.setItem(this.prefix + key, value);
        } catch (e) {
            console.error('Failed to save to localStorage:', e);
        }
    }

    async removeItem(key: string): Promise<void> {
        try {
            localStorage.removeItem(this.prefix + key);
        } catch (e) {
            console.warn('Failed to remove from localStorage:', e);
        }
    }
}
