import { describe, expect, it, beforeEach } from "vitest";
import { Cl, ClarityType, ResponseOkCV, BufferCV, UIntCV } from "@stacks/transactions";
import { hexToBytes } from "@stacks/common";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;

// Helper to create a 32-byte Merkle root as Clarity buffer
function createMerkleRoot() {
  return Cl.buffer(new Uint8Array(32));
}

describe("Revocation Registry Contract", () => {
  describe("update-revocation-root", () => {
    it("should allow deployer to update revocation root", () => {
      const newRoot = createMerkleRoot();

      const { result } = simnet.callPublicFn(
        "revocation",
        "update-revocation-root",
        [newRoot],
        deployer
      );

      expect(result).toBeOk(Cl.bool(true));

      // Verify root was updated
      const { result: rootResult } = simnet.callReadOnlyFn(
        "revocation",
        "get-revocation-root",
        [],
        deployer
      );

      expect(rootResult).toBeOk(newRoot);
    });

    it("should not allow non-deployer to update revocation root", () => {
      const newRoot = createMerkleRoot();

      const { result } = simnet.callPublicFn(
        "revocation",
        "update-revocation-root",
        [newRoot],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(3001)); // ERR_NOT_AUTHORIZED
    });

    it("should reject invalid root length", () => {
      const invalidRoot = Cl.buffer(new Uint8Array(31)); // 31 bytes instead of 32

      const { result } = simnet.callPublicFn(
        "revocation",
        "update-revocation-root",
        [invalidRoot],
        deployer
      );

      expect(result).toBeErr(Cl.uint(3002)); // ERR_INVALID_ROOT
    });

    it("should update revocation root height", () => {
      const newRoot = createMerkleRoot();

      simnet.callPublicFn(
        "revocation",
        "update-revocation-root",
        [newRoot],
        deployer
      );

      const { result: heightResult } = simnet.callReadOnlyFn(
        "revocation",
        "get-revocation-root-height",
        [],
        deployer
      );

      // Block height will be the height when update was called
      // Just verify it's a valid uint (greater than 0)
      // heightResult is a ResponseOkCV<UIntCV>
      expect(heightResult).toHaveClarityType(ClarityType.ResponseOk);
      const okResult = heightResult as ResponseOkCV<UIntCV>;
      expect(okResult.value.type).toBe(ClarityType.UInt);
      expect(Number(okResult.value.value)).toBeGreaterThan(0);
    });

    it("should allow multiple root updates", () => {
      const root1 = createMerkleRoot();
      const root2Bytes = new Uint8Array(32);
      root2Bytes.fill(1);
      const root2 = Cl.buffer(root2Bytes);

      const result1 = simnet.callPublicFn(
        "revocation",
        "update-revocation-root",
        [root1],
        deployer
      );

      const result2 = simnet.callPublicFn(
        "revocation",
        "update-revocation-root",
        [root2],
        deployer
      );

      expect(result1.result).toBeOk(Cl.bool(true));
      expect(result2.result).toBeOk(Cl.bool(true));

      // Verify latest root
      const { result: rootResult } = simnet.callReadOnlyFn(
        "revocation",
        "get-revocation-root",
        [],
        deployer
      );

      // Check that result is ok and contains the expected buffer
      // rootResult is a ResponseOkCV<BufferCV>
      expect(rootResult).toHaveClarityType(ClarityType.ResponseOk);
      const okResult = rootResult as ResponseOkCV<BufferCV>;
      expect(okResult.value).toBeDefined();
      expect(okResult.value.type).toBe(ClarityType.Buffer);
      // BufferCV.value is a hex string, convert to bytes
      const resultBuffer = hexToBytes(okResult.value.value);
      expect(resultBuffer.length).toBe(32);
      expect(Array.from(resultBuffer)).toEqual(Array.from(root2Bytes));
    });
  });

  describe("get-revocation-root", () => {
    it("should return initial zero root", () => {
      const { result } = simnet.callReadOnlyFn(
        "revocation",
        "get-revocation-root",
        [],
        deployer
      );

      // Clarity returns buffers as Clarity Values
      // Check that result is ok and contains a zero buffer
      // result is a ResponseOkCV<BufferCV>
      expect(result).toHaveClarityType(ClarityType.ResponseOk);
      const okResult = result as ResponseOkCV<BufferCV>;
      expect(okResult.value).toBeDefined();
      expect(okResult.value.type).toBe(ClarityType.Buffer);
      // BufferCV.value is a hex string, convert to bytes
      const resultBuffer = hexToBytes(okResult.value.value);
      expect(resultBuffer.length).toBe(32);
      expect(resultBuffer.every(b => b === 0)).toBe(true);
    });

    it("should return updated root after update", () => {
      const newRoot = createMerkleRoot();

      simnet.callPublicFn(
        "revocation",
        "update-revocation-root",
        [newRoot],
        deployer
      );

      const { result } = simnet.callReadOnlyFn(
        "revocation",
        "get-revocation-root",
        [],
        deployer
      );

      expect(result).toBeOk(newRoot);
    });
  });

  describe("get-revocation-root-height", () => {
    it("should return initial height of 0", () => {
      const { result } = simnet.callReadOnlyFn(
        "revocation",
        "get-revocation-root-height",
        [],
        deployer
      );

      expect(result).toBeOk(Cl.uint(0));
    });

    it("should return block height when root was updated", () => {
      const newRoot = createMerkleRoot();

      simnet.callPublicFn(
        "revocation",
        "update-revocation-root",
        [newRoot],
        deployer
      );

      const { result } = simnet.callReadOnlyFn(
        "revocation",
        "get-revocation-root-height",
        [],
        deployer
      );

      // Block height will be the height when update was called
      // Just verify it's a valid uint response
      // result is a ResponseOkCV<UIntCV>
      expect(result).toHaveClarityType(ClarityType.ResponseOk);
      const okResult = result as ResponseOkCV<UIntCV>;
      expect(okResult.value).toBeDefined();
      expect(okResult.value.type).toBe(ClarityType.UInt);
      expect(Number(okResult.value.value)).toBeGreaterThan(0);
    });
  });

  describe("is-revoked?", () => {
    it("should return false (placeholder implementation)", () => {
      // Use hex string for buffer argument
      const commitment = Cl.buffer(new Uint8Array(32));

      const { result } = simnet.callReadOnlyFn(
        "revocation",
        "is-revoked?",
        [commitment],
        deployer
      );

      // Current implementation always returns false
      expect(result).toBeOk(Cl.bool(false));
    });
  });
});