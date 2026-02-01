/**
 * Circuit constants for Noah-v2 KYC Circuit
 * These must remain in sync with the circuit defined in kyc.go
 */

export const CIRCUIT_CONSTANTS = {
    // Number of jurisdiction slots in the circuit
    ALLOWED_JURISDICTIONS_COUNT: 10,

    // Indices of public inputs in the generated proof
    PUBLIC_INPUTS: {
        COMMITMENT: 0,
        MIN_AGE: 1,
        JURISDICTIONS_START: 2,
        REQUIRE_ACCREDITATION: 12,
        ATTESTER_PUBKEY_START: 13, // 13 (X) and 14 (Y)
    }
};
