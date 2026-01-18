;; KYC Registry Contract
;; Stores user KYC commitments and verifies attestation signatures

(define-constant contract-owner tx-sender)

;; (use-trait attester .attester-registry-trait.attester-registry-trait)

(define-map kyc-registry { user: principal } 
  { 
    commitment: (buff 32), 
    attester-id: uint, 
    registered-at: uint
  })

(define-constant ERR_NOT_AUTHORIZED (err u2000))
(define-constant ERR_INVALID_ATTESTER (err u2001))
(define-constant ERR_INVALID_SIGNATURE (err u2002))
(define-constant ERR_KYC_NOT_FOUND (err u2003))
(define-constant ERR_INVALID_COMMITMENT (err u2005))

;; Register KYC for a user
;; Stores a user's KYC commitment after verifying the attestation signature
;; KYC records are permanent until explicitly revoked by the contract owner
;; 
;; @param commitment - 32-byte hash commitment of user's identity data (SHA-256 hash)
;; @param signature - 64 or 65-byte ECDSA signature (r || s || optional v format) from the attester
;; @param attester-id - Unique identifier of the attester who issued this KYC
;; @return (ok true) on successful registration
;; @error ERR_INVALID_COMMITMENT (u2005) - If commitment length is not 32 bytes
;; @error ERR_INVALID_SIGNATURE (u2002) - If signature length is not 64 or 65 bytes or signature verification fails
;; @error ERR_INVALID_ATTESTER (u2001) - If attester does not exist or is inactive
;; 
;; Side effects:
;; - Creates or updates KYC record for tx-sender
;; - Stores commitment, attester-id, and registration block height
;; 
;; Security:
;; - Verifies attester is active before accepting the signature
;; - Cryptographically verifies signature using secp256k1-verify
;; - Prevents users from registering invalid or unauthorized KYC credentials
(define-public (register-kyc (commitment (buff 32)) (signature (buff 65)) (attester-id uint))
  (begin
    ;; Verify commitment length
    (asserts! (is-eq (len commitment) u32) ERR_INVALID_COMMITMENT)
    
    ;; Verify signature length (accepts 64 or 65 bytes)
    (asserts! (or (is-eq (len signature) u64) (is-eq (len signature) u65)) ERR_INVALID_SIGNATURE)
    
    ;; Check attester is active
    (asserts! (unwrap-panic (contract-call? .attester-registry is-attester-active? attester-id)) ERR_INVALID_ATTESTER)
    
    ;; Get attester public key
    (let ((pubkey (unwrap-panic (contract-call? .attester-registry get-attester-pubkey attester-id))))
      ;; Verify signature
      (asserts! (secp256k1-verify commitment signature pubkey) ERR_INVALID_SIGNATURE)
      
      ;; Store KYC record
      (map-set kyc-registry { user: tx-sender } 
        { 
          commitment: commitment, 
          attester-id: attester-id, 
          registered-at: stacks-block-height
        })
      (ok true)
    )
  )
)

;; Check if a user has registered KYC
;; 
;; @param user - Stacks principal address of the user to check
;; @return (ok true) if user has a KYC record in the registry
;; @return (ok false) if user has no KYC record
;; 
;; Note: This function only checks for the existence of a KYC record.
;; KYC records are permanent and do not expire - they remain valid until revoked.
(define-read-only (has-kyc? (user principal))
  (match (map-get? kyc-registry { user: user })
    kyc-record (ok true)
    (ok false)
  )
)

;; Get KYC details for a user
;; Returns the full KYC record including commitment, attester-id, and registration timestamp
;; 
;; @param user - Stacks principal address of the user
;; @return (ok (some kyc-record)) - KYC record tuple containing:
;;   - commitment: (buff 32) - Identity commitment hash
;;   - attester-id: uint - ID of the attester who issued the KYC
;;   - registered-at: uint - Block height when KYC was registered
;; @return (ok none) - If user has no KYC record
;; 
;; Use case: Applications can retrieve KYC details to verify which attester issued the credential
;; and when it was registered
(define-read-only (get-kyc (user principal))
  (match (map-get? kyc-registry { user: user })
    kyc-record (ok (some kyc-record))
    (ok none)
  )
)

;; Check if a user's KYC is valid
;; 
;; @param user - Stacks principal address of the user to check
;; @return (ok true) if user has a valid KYC record
;; @return (ok false) if user has no KYC record
;; 
;; Note: This function is functionally equivalent to has-kyc? since KYC records
;; do not expire. Both functions return true if a KYC record exists, false otherwise.
;; This function name provides a more semantic API for applications checking KYC validity.
(define-read-only (is-kyc-valid? (user principal))
  (match (map-get? kyc-registry { user: user })
    kyc-record (ok true)
    (ok false)
  )
)

;; Revoke KYC for a user
;; Only the contract owner can revoke KYC records
;; Used for compliance, fraud prevention, or when a user's KYC status changes
;; 
;; @param user - Stacks principal address of the user whose KYC should be revoked
;; @return (ok true) on successful revocation
;; @error ERR_NOT_AUTHORIZED (u2000) - If caller is not the contract owner
;; @error ERR_KYC_NOT_FOUND (u2003) - If user has no KYC record to revoke
;; 
;; Side effects:
;; - Permanently removes the KYC record from the registry
;; - User will no longer pass has-kyc? or is-kyc-valid? checks
;; - User must re-register KYC to restore access
;; 
;; Note: Revocation is permanent and cannot be undone automatically.
;; If needed, the user must go through the full KYC registration process again.
(define-public (revoke-kyc (user principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) ERR_NOT_AUTHORIZED)
    (match (map-get? kyc-registry { user: user })
      kyc-record (begin
        (map-delete kyc-registry { user: user })
        (ok true)
      )
      ERR_KYC_NOT_FOUND
    )
  )
)