/**
 * Noah SDK Custom Errors
 */

export enum NoahErrorCode {
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    CONTRACT_ERROR = 'CONTRACT_ERROR',
    PROVER_ERROR = 'PROVER_ERROR',
    ATTESTER_ERROR = 'ATTESTER_ERROR',
    NETWORK_ERROR = 'NETWORK_ERROR',
    TIMEOUT_ERROR = 'TIMEOUT_ERROR',
    UNAUTHORIZED = 'UNAUTHORIZED',
}

export class NoahError extends Error {
    constructor(
        public code: NoahErrorCode,
        public message: string,
        public details?: any
    ) {
        super(message);
        this.name = 'NoahError';
        Object.setPrototypeOf(this, NoahError.prototype);
    }
}

export class ContractError extends NoahError {
    constructor(message: string, details?: any) {
        super(NoahErrorCode.CONTRACT_ERROR, message, details);
        this.name = 'ContractError';
    }
}

export class ProverError extends NoahError {
    constructor(message: string, details?: any) {
        super(NoahErrorCode.PROVER_ERROR, message, details);
        this.name = 'ProverError';
    }
}

export class AttesterError extends NoahError {
    constructor(message: string, details?: any) {
        super(NoahErrorCode.ATTESTER_ERROR, message, details);
        this.name = 'AttesterError';
    }
}

export class ValidationError extends NoahError {
    constructor(message: string, details?: any) {
        super(NoahErrorCode.VALIDATION_ERROR, message, details);
        this.name = 'ValidationError';
    }
}
