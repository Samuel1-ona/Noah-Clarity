package main

// Point represents a point on a twisted Edwards curve
type Point struct {
	X string `json:"x"`
	Y string `json:"y"`
}

// EdDSASignature represents an EdDSA signature for ZK circuits
type EdDSASignature struct {
	R Point  `json:"r"`
	S string `json:"s"`
}

// EdDSAPublicKey represents an EdDSA public key for ZK circuits
type EdDSAPublicKey struct {
	A Point `json:"a"`
}

// CredentialRequest represents a request to issue a credential
type CredentialRequest struct {
	UserID         string                 `json:"user_id"`
	UserAddress    string                 `json:"user_address"`
	IdentityData   string                 `json:"identity_data,omitempty"` // Optional if UserCommitment provided
	Nonce          string                 `json:"nonce,omitempty"`         // Optional if UserCommitment provided
	UserCommitment string                 `json:"user_commitment,omitempty"`
	Attributes     map[string]interface{} `json:"attributes"`
	Documents      []DocumentInfo         `json:"documents"` // Document info extracted via OCR
}

// DocumentInfo represents verified data from an identity document
type DocumentInfo struct {
	Type        string `json:"type"`          // "Passport", "NationalID", etc.
	Number      string `json:"number"`        // Unique ID number
	Country     string `json:"country"`       // ISO Country code
	DateOfBirth string `json:"date_of_birth"` // YYMMDD
	ExpiryDate  string `json:"expiry_date"`   // YYMMDD
	Age         int    `json:"age"`           // Calculated age
}

// Credential represents an issued credential
type Credential struct {
	UserID            string                 `json:"user_id"`
	Attributes        map[string]interface{} `json:"attributes"`
	Commitment        string                 `json:"commitment"`
	Signature         string                 `json:"signature"` // ECDSA signature (hex)
	EdDSASignature    EdDSASignature         `json:"eddsa_signature"`
	AttesterPublicKey EdDSAPublicKey         `json:"attester_public_key"`
	IssuedAt          int64                  `json:"issued_at"`
	ExpiresAt         int64                  `json:"expires_at"`
	AttesterID        uint                   `json:"attester_id"`
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
	Commitment        string         `json:"commitment"`
	Signature         string         `json:"signature"` // ECDSA signature (hex)
	EdDSASignature    EdDSASignature `json:"eddsa_signature"`
	AttesterPublicKey EdDSAPublicKey `json:"attester_public_key"`
	AttesterID        uint           `json:"attester_id"`
	Expiry            uint64         `json:"expiry"`
	Success           bool           `json:"success"`
	Error             string         `json:"error,omitempty"`
}

// RevocationRequest represents a request to revoke a credential
type RevocationRequest struct {
	Commitment string `json:"commitment"`
	Reason     string `json:"reason,omitempty"`
}
