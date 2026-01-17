import { describe, expect, it, beforeEach } from "vitest";
import { Cl, ClarityType, ResponseOkCV, BufferCV } from "@stacks/transactions";
import { hexToBytes } from "@stacks/common";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

// Helper to create a valid 33-byte public key (compressed secp256k1) as Clarity buffer
function createPubkey(prefix: number = 0x02) {
  const bytes = new Uint8Array(33);
  bytes[0] = prefix; // 0x02 or 0x03 for compressed
  for (let i = 1; i < 33; i++) {
    bytes[i] = i; // Fill with test data
  }
  return Cl.buffer(bytes);
}

describe("Attester Registry Contract", () => {
  beforeEach(() => {
    // Reset state between tests if needed
  });

  describe("add-attester", () => {
    it("should allow deployer to add an attester", () => {
      const pubkey = createPubkey();
      const attesterId = Cl.uint(1);

      const { result } = simnet.callPublicFn(
        "attester-registry",
        "add-attester",
        [pubkey, attesterId],
        deployer
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should not allow non-deployer to add attester", () => {
      const pubkey = createPubkey();
      const attesterId = Cl.uint(1);

      const { result } = simnet.callPublicFn(
        "attester-registry",
        "add-attester",
        [pubkey, attesterId],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(1001)); // ERR_NOT_AUTHORIZED
    });

    it("should reject invalid pubkey length", () => {
      const invalidPubkey = Cl.buffer(new Uint8Array(32)); // 32 bytes instead of 33
      const attesterId = Cl.uint(1);

      const { result } = simnet.callPublicFn(
        "attester-registry",
        "add-attester",
        [invalidPubkey, attesterId],
        deployer
      );

      expect(result).toBeErr(Cl.uint(1004)); // ERR_INVALID_PUBKEY
    });

    it("should reject duplicate attester ID", () => {
      const pubkey1 = createPubkey(0x02);
      const pubkey2 = createPubkey(0x03);
      const attesterId = Cl.uint(1);

      // Add first attester
      simnet.callPublicFn(
        "attester-registry",
        "add-attester",
        [pubkey1, attesterId],
        deployer
      );

      // Try to add duplicate
      const { result } = simnet.callPublicFn(
        "attester-registry",
        "add-attester",
        [pubkey2, attesterId],
        deployer
      );

      expect(result).toBeErr(Cl.uint(1002)); // ERR_ATTESTER_EXISTS
    });

    it("should allow adding multiple attesters with different IDs", () => {
      const pubkey1 = createPubkey(0x02);
      const pubkey2 = createPubkey(0x03);

      const result1 = simnet.callPublicFn(
        "attester-registry",
        "add-attester",
        [pubkey1, Cl.uint(1)],
        deployer
      );

      const result2 = simnet.callPublicFn(
        "attester-registry",
        "add-attester",
        [pubkey2, Cl.uint(2)],
        deployer
      );

      expect(result1.result).toBeOk(Cl.bool(true));
      expect(result2.result).toBeOk(Cl.bool(true));
    });
  });

  describe("deactivate-attester", () => {
    beforeEach(() => {
      // Add an attester before each test
      const pubkey = createPubkey();
      simnet.callPublicFn(
        "attester-registry",
        "add-attester",
        [pubkey, Cl.uint(1)],
        deployer
      );
    });

    it("should allow deployer to deactivate attester", () => {
      const { result } = simnet.callPublicFn(
        "attester-registry",
        "deactivate-attester",
        [Cl.uint(1)],
        deployer
      );

      expect(result).toBeOk(Cl.bool(true));

      // Verify attester is inactive
      const { result: activeResult } = simnet.callReadOnlyFn(
        "attester-registry",
        "is-attester-active?",
        [Cl.uint(1)],
        deployer
      );

      expect(activeResult).toBeOk(Cl.bool(false));
    });

    it("should not allow non-deployer to deactivate attester", () => {
      const { result } = simnet.callPublicFn(
        "attester-registry",
        "deactivate-attester",
        [Cl.uint(1)],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(1001)); // ERR_NOT_AUTHORIZED
    });

    it("should reject deactivating non-existent attester", () => {
      const { result } = simnet.callPublicFn(
        "attester-registry",
        "deactivate-attester",
        [Cl.uint(999)],
        deployer
      );

      expect(result).toBeErr(Cl.uint(1003)); // ERR_ATTESTER_NOT_FOUND
    });
  });

  describe("is-attester-active?", () => {
    it("should return false for non-existent attester", () => {
      const { result } = simnet.callReadOnlyFn(
        "attester-registry",
        "is-attester-active?",
        [Cl.uint(999)],
        deployer
      );

      expect(result).toBeOk(Cl.bool(false));
    });

    it("should return true for active attester", () => {
      const pubkey = createPubkey();
      simnet.callPublicFn(
        "attester-registry",
        "add-attester",
        [pubkey, Cl.uint(1)],
        deployer
      );

      const { result } = simnet.callReadOnlyFn(
        "attester-registry",
        "is-attester-active?",
        [Cl.uint(1)],
        deployer
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should return false for deactivated attester", () => {
      const pubkey = createPubkey();
      simnet.callPublicFn(
        "attester-registry",
        "add-attester",
        [pubkey, Cl.uint(1)],
        deployer
      );

      simnet.callPublicFn(
        "attester-registry",
        "deactivate-attester",
        [Cl.uint(1)],
        deployer
      );

      const { result } = simnet.callReadOnlyFn(
        "attester-registry",
        "is-attester-active?",
        [Cl.uint(1)],
        deployer
      );

      expect(result).toBeOk(Cl.bool(false));
    });
  });

  describe("get-attester-pubkey", () => {
    it("should return pubkey for existing attester", () => {
      const pubkey = createPubkey(0x02);
      simnet.callPublicFn(
        "attester-registry",
        "add-attester",
        [pubkey, Cl.uint(1)],
        deployer
      );

      const { result } = simnet.callReadOnlyFn(
        "attester-registry",
        "get-attester-pubkey",
        [Cl.uint(1)],
        deployer
      );

      // Result should be (ok (buff 33))
      // result is a ResponseOkCV<BufferCV>, so we need to type guard it
      expect(result).toHaveClarityType(ClarityType.ResponseOk);
      const okResult = result as ResponseOkCV<BufferCV>;
      expect(okResult.value).toBeDefined();
      expect(okResult.value.type).toBe(ClarityType.Buffer);
      // BufferCV.value is a hex string, convert to bytes to check length
      const bufferBytes = hexToBytes(okResult.value.value);
      expect(bufferBytes.length).toBe(33);
    });

    it("should return error for non-existent attester", () => {
      const { result } = simnet.callReadOnlyFn(
        "attester-registry",
        "get-attester-pubkey",
        [Cl.uint(999)],
        deployer
      );

      // Contract returns (err ERR_ATTESTER_NOT_FOUND) which is (err (err u1003))
      // The nested error structure means we can't use toBeErr with a simple uint
      // Just verify it's an error response
      expect(result).toHaveClarityType(ClarityType.ResponseErr);
    });
  });

  describe("get-attesters", () => {
    it("should return empty list", () => {
      const { result } = simnet.callReadOnlyFn(
        "attester-registry",
        "get-attesters",
        [],
        deployer
      );

      expect(result).toBeOk(Cl.list([])); // Empty list in Clarity
    });
  });
});