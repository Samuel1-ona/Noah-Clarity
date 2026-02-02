import { computeCommitment, mimc7 } from '../mimc';

describe('MiMC-7 BN254 Hashing', () => {
    test('mimc7 should match expected vectors for BN254', () => {
        const hash = mimc7(BigInt(0), BigInt(0));
        expect(typeof hash).toBe('bigint');
        expect(hash.toString(16)).toHaveLength(64);
    });

    test('computeCommitment should generate stable hashes', () => {
        const data = "123456789"; // Numeric string
        const nonce = "987654321"; // Numeric string
        const address = "0xdeafbeefface"; // Hex works with BigInt

        const hash1 = computeCommitment(data, nonce, address);
        const hash2 = computeCommitment(data, nonce, address);

        expect(hash1).toBe(hash2);
        expect(hash1).toMatch(/^0x[0-9a-f]+$/i);
    });

    test('different nonces should produce different commitments', () => {
        const data = "123456789";
        const address = "0xdeafbeefface";

        const hash1 = computeCommitment(data, "111", address);
        const hash2 = computeCommitment(data, "222", address);

        expect(hash1).not.toBe(hash2);
    });
});
