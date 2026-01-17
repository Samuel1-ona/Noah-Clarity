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
;; commitment: 32-byte commitment hash
;; signature: 65-byte ECDSA signature (r || s || v)
;; attester-id: ID of the attester who signed
(define-public (register-kyc (commitment (buff 32)) (signature (buff 65)) (attester-id uint))
  (begin
    ;; Verify commitment length
    (asserts! (is-eq (len commitment) u32) ERR_INVALID_COMMITMENT)
    
    ;; Verify signature length
    (asserts! (is-eq (len signature) u65) ERR_INVALID_SIGNATURE)
    
    ;; Check attester is active
    (let ((active-result (contract-call? .attester-registry is-attester-active? attester-id)))
      (asserts! (unwrap-panic active-result) ERR_INVALID_ATTESTER)
    )
    
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

;; Check if user has valid KYC
;; Returns (ok true) if valid, (ok false) if not found
(define-read-only (has-kyc? (user principal))
  (match (map-get? kyc-registry { user: user })
    kyc-record (ok true)
    (ok false)
  )
)

;; Get KYC details for a user
(define-read-only (get-kyc (user principal))
  (match (map-get? kyc-registry { user: user })
    kyc-record (ok (some kyc-record))
    (ok none)
  )
)

;; Check if KYC is valid
(define-read-only (is-kyc-valid? (user principal))
  (match (map-get? kyc-registry { user: user })
    kyc-record (ok true)
    (ok false)
  )
)

;; Revoke KYC for a user (only contract owner)
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