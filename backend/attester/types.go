package main

// CredentialRequest represents a request to issue a credential
type CredentialRequest struct {
	UserID      string                 `json:"user_id"`
	Attributes  map[string]interface{} `json:"attributes"`
	Documents   []string                `json:"documents"` // Document hashes or IDs
}

// Credential represents an issued credential
type Credential struct {
	UserID        string                 `json:"user_id"`
	Attributes    map[string]interface{} `json:"attributes"`
	Commitment    string                 `json:"commitment"`
	IssuedAt      int64                  `json:"issued_at"`
	ExpiresAt     int64                  `json:"expires_at"`
	AttesterID    uint                   `json:"attester_id"`
}

// AttestationRequest represents a request to sign a commitment
type AttestationRequest struct {
	Commitment    string   `json:"commitment"`
	PublicInputs  []string `json:"public_inputs"`
	Proof         string   `json:"proof"` // Serialized proof
	UserID        string   `json:"user_id"`
}

// AttestationResponse contains the signed attestation
type AttestationResponse struct {
	Commitment    string `json:"commitment"`
	Signature     string `json:"signature"` // 65-byte signature (r || s || v)
	AttesterID    uint   `json:"attester_id"`
	Expiry        uint64 `json:"expiry"`
	Success       bool   `json:"success"`
	Error         string `json:"error,omitempty"`
}

// RevocationRequest represents a request to revoke a credential
type RevocationRequest struct {
	Commitment string `json:"commitment"`
	Reason     string `json:"reason,omitempty"`
}

