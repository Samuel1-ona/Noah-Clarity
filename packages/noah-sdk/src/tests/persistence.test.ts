import { BrowserStorage } from '../storage';
import { BlindingManager } from '../blinding';

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => { store[key] = value.toString(); },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { store = {}; }
    };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

describe('SDK Persistence Layer', () => {
    beforeEach(() => {
        localStorageMock.clear();
    });

    test('BrowserStorage should save and retrieve items', async () => {
        const storage = new BrowserStorage('test_');
        await storage.setItem('key1', 'value1');
        const val = await storage.getItem('key1');
        expect(val).toBe('value1');
        expect(localStorageMock.getItem('test_key1')).toBe('value1');
    });

    test('BlindingManager should persist nonces across instances', async () => {
        const storage = new BrowserStorage();
        const manager1 = new BlindingManager(storage);

        const address = "ST123";
        const nonce1 = await manager1.getOrCreateNonce(address);

        // Simulate new instance
        const manager2 = new BlindingManager(storage);
        const nonce2 = await manager2.getOrCreateNonce(address);

        expect(nonce1).toBe(nonce2);
        expect(nonce1).toHaveLength(64); // Our hex generator length
    });

    test('BlindingManager should generate unique nonces for different addresses', async () => {
        const storage = new BrowserStorage();
        const manager = new BlindingManager(storage);

        const nonce1 = await manager.getOrCreateNonce("ADDR1");
        const nonce2 = await manager.getOrCreateNonce("ADDR2");

        expect(nonce1).not.toBe(nonce2);
    });
});
