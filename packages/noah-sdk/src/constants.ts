/**
 * Circuit constants for Noah-v2 KYC Circuit
 * These must remain in sync with the circuit defined in kyc.go
 */

export const CIRCUIT_CONSTANTS = {
    // Number of jurisdiction slots in the circuit
    ALLOWED_JURISDICTIONS_COUNT: 10,

    // Indices of public inputs in the generated proof
    // Order from kyc.go: MinAge, JurisdictionRoot, RequireAccreditation, UserAddress, Commitment, AttesterPublicKey
    PUBLIC_INPUTS: {
        MIN_AGE: 0,
        JURISDICTION_ROOT: 1,
        REQUIRE_ACCREDITATION: 2,
        USER_ADDRESS: 3,
        COMMITMENT: 4,
        ATTESTER_PUBKEY_START: 5, // 5 (X) and 6 (Y)
    }
};
