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
    it("should allow deployer to add an attester with address", () => {
      const pubkey = createPubkey();
      const attesterId = Cl.uint(1);
      const attesterAddress = Cl.principal(wallet1);

      const { result } = simnet.callPublicFn(
        "attester-registry",
        "add-attester",
        [pubkey, attesterId, attesterAddress],
        deployer
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should not allow non-deployer to add attester", () => {
      const pubkey = createPubkey();
      const attesterId = Cl.uint(1);
      const attesterAddress = Cl.principal(wallet1);

      const { result } = simnet.callPublicFn(
        "attester-registry",
        "add-attester",
        [pubkey, attesterId, attesterAddress],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(1001)); // ERR_NOT_AUTHORIZED
    });

    it("should reject invalid pubkey length", () => {
      const invalidPubkey = Cl.buffer(new Uint8Array(32)); // 32 bytes instead of 33
      const attesterId = Cl.uint(1);
      const attesterAddress = Cl.principal(wallet1);

      const { result } = simnet.callPublicFn(
        "attester-registry",
        "add-attester",
        [invalidPubkey, attesterId, attesterAddress],
        deployer
      );

      expect(result).toBeErr(Cl.uint(1004)); // ERR_INVALID_PUBKEY
    });

    it("should reject duplicate attester ID", () => {
      const pubkey1 = createPubkey(0x02);
      const pubkey2 = createPubkey(0x03);
      const attesterId = Cl.uint(1);
      const attesterAddress = Cl.principal(wallet1);

      // Add first attester
      simnet.callPublicFn(
        "attester-registry",
        "add-attester",
        [pubkey1, attesterId, attesterAddress],
        deployer
      );

      // Try to add duplicate
      const { result } = simnet.callPublicFn(
        "attester-registry",
        "add-attester",
        [pubkey2, attesterId, attesterAddress],
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
        [pubkey1, Cl.uint(1), Cl.principal(wallet1)],
        deployer
      );

      const result2 = simnet.callPublicFn(
        "attester-registry",
        "add-attester",
        [pubkey2, Cl.uint(2), Cl.principal(wallet2)],
        deployer
      );

      expect(result1.result).toBeOk(Cl.bool(true));
      expect(result2.result).toBeOk(Cl.bool(true));
    });
  });

  describe("update-attester-address", () => {
    it("should allow owner to update attester address", () => {
      const pubkey = createPubkey();
      simnet.callPublicFn(
        "attester-registry",
        "add-attester",
        [pubkey, Cl.uint(1), Cl.principal(wallet1)],
        deployer
      );

      const { result } = simnet.callPublicFn(
        "attester-registry",
        "update-attester-address",
        [Cl.principal(wallet2), Cl.uint(1)],
        deployer
      );

      expect(result).toBeOk(Cl.bool(true));

      // Verify new address
      const { result: addressResult } = simnet.callReadOnlyFn(
        "attester-registry",
        "get-attester-address",
        [Cl.uint(1)],
        deployer
      );
      expect(addressResult).toBeOk(Cl.principal(wallet2));
    });
  });

  describe("deactivate-attester", () => {
    beforeEach(() => {
      // Add an attester before each test
      const pubkey = createPubkey();
      simnet.callPublicFn(
        "attester-registry",
        "add-attester",
        [pubkey, Cl.uint(1), Cl.principal(wallet1)],
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
        [pubkey, Cl.uint(1), Cl.principal(wallet1)],
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
  });

  describe("get-attester-pubkey", () => {
    it("should return pubkey for existing attester", () => {
      const pubkey = createPubkey(0x02);
      simnet.callPublicFn(
        "attester-registry",
        "add-attester",
        [pubkey, Cl.uint(1), Cl.principal(wallet1)],
        deployer
      );

      const { result } = simnet.callReadOnlyFn(
        "attester-registry",
        "get-attester-pubkey",
        [Cl.uint(1)],
        deployer
      );

      expect(result).toHaveClarityType(ClarityType.ResponseOk);
      const okResult = result as ResponseOkCV<BufferCV>;
      expect(okResult.value).toBeDefined();
      expect(okResult.value.type).toBe(ClarityType.Buffer);
      const bufferBytes = hexToBytes(okResult.value.value);
      expect(bufferBytes.length).toBe(33);
    });
  });

  describe("get-attester-address", () => {
    it("should return address for existing attester", () => {
      const pubkey = createPubkey(0x02);
      simnet.callPublicFn(
        "attester-registry",
        "add-attester",
        [pubkey, Cl.uint(1), Cl.principal(wallet1)],
        deployer
      );

      const { result } = simnet.callReadOnlyFn(
        "attester-registry",
        "get-attester-address",
        [Cl.uint(1)],
        deployer
      );

      expect(result).toBeOk(Cl.principal(wallet1));
    });
  });

  describe("get-attesters (Discovery)", () => {
    it("should return list of registered attesters", () => {
      const pubkey1 = createPubkey(0x02);
      const pubkey2 = createPubkey(0x03);

      simnet.callPublicFn(
        "attester-registry",
        "add-attester",
        [pubkey1, Cl.uint(1), Cl.principal(wallet1)],
        deployer
      );

      simnet.callPublicFn(
        "attester-registry",
        "add-attester",
        [pubkey2, Cl.uint(2), Cl.principal(wallet2)],
        deployer
      );

      const { result } = simnet.callReadOnlyFn(
        "attester-registry",
        "get-attesters",
        [],
        deployer
      );

      expect(result).toBeOk(Cl.list([Cl.uint(1), Cl.uint(2)]));
    });
  });

  describe("transfer-ownership", () => {
    it("should allow owner to transfer ownership", () => {
      const { result } = simnet.callPublicFn(
        "attester-registry",
        "transfer-ownership",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(result).toBeOk(Cl.bool(true));

      // Verify new owner can add attester (deployer cannot anymore)
      const pubkey = createPubkey();
      const failResult = simnet.callPublicFn(
        "attester-registry",
        "add-attester",
        [pubkey, Cl.uint(3), Cl.principal(wallet2)],
        deployer
      );
      expect(failResult.result).toBeErr(Cl.uint(1001));

      const successResult = simnet.callPublicFn(
        "attester-registry",
        "add-attester",
        [pubkey, Cl.uint(3), Cl.principal(wallet2)],
        wallet1
      );
      expect(successResult.result).toBeOk(Cl.bool(true));
    });
  });
});