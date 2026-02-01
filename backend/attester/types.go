package main

// CredentialRequest represents a request to issue a credential
type CredentialRequest struct {
	UserID       string                 `json:"user_id"`
	UserAddress  string                 `json:"user_address"`
	IdentityData string                 `json:"identity_data"` // Private data to be hidden in ZK
	Nonce        string                 `json:"nonce"`         // Random salt
	Attributes   map[string]interface{} `json:"attributes"`
	Documents    []DocumentInfo         `json:"documents"` // Document info extracted via OCR
}

// DocumentInfo represents verified data from an identity document
type DocumentInfo struct {
	Type    string `json:"type"`    // "Passport", "NationalID", etc.
	Number  string `json:"number"`  // Unique ID number
	Country string `json:"country"` // ISO Country code
}

// Credential represents an issued credential
type Credential struct {
	UserID     string                 `json:"user_id"`
	Attributes map[string]interface{} `json:"attributes"`
	Commitment string                 `json:"commitment"`
	IssuedAt   int64                  `json:"issued_at"`
	ExpiresAt  int64                  `json:"expires_at"`
	AttesterID uint                   `json:"attester_id"`
}

// AttestationRequest represents a request to sign a commitment
type AttestationRequest struct {
	Commitment   string   `json:"commitment"`
	PublicInputs []string `json:"public_inputs"`
	Proof        string   `json:"proof"` // Serialized proof
	UserID       string   `json:"user_id"`
}

// AttestationResponse contains the signed attestation
type AttestationResponse struct {
	Commitment string `json:"commitment"`
	Signature  string `json:"signature"` // 64-byte signature (r || s) for Clarity compatibility
	AttesterID uint   `json:"attester_id"`
	Expiry     uint64 `json:"expiry"`
	Success    bool   `json:"success"`
	Error      string `json:"error,omitempty"`
}

// RevocationRequest represents a request to revoke a credential
type RevocationRequest struct {
	Commitment string `json:"commitment"`
	Reason     string `json:"reason,omitempty"`
}
