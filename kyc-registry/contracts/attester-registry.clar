;; Attester Registry Contract
;; Manages trusted attesters (KYC providers) who can issue credentials

(define-constant contract-owner tx-sender)

(define-map attester-by-id { id: uint } { pubkey: (buff 33), active: bool })

(define-constant ERR_NOT_AUTHORIZED (err u1001))
(define-constant ERR_ATTESTER_EXISTS (err u1002))
(define-constant ERR_ATTESTER_NOT_FOUND (err u1003))
(define-constant ERR_INVALID_PUBKEY (err u1004))

;; Add a new attester to the registry
;; Only the contract owner can add new attesters
;; 
;; @param pubkey - Compressed secp256k1 public key (33 bytes) of the attester
;; @param id - Unique identifier for the attester
;; @return (ok true) on success
;; @error ERR_NOT_AUTHORIZED (u1001) - If caller is not the contract owner
;; @error ERR_INVALID_PUBKEY (u1004) - If pubkey length is not 33 bytes
;; @error ERR_ATTESTER_EXISTS (u1002) - If an attester with this ID already exists
;; 
;; Side effects:
;; - Creates a new entry in attester-by-id map with active: true
(define-public (add-attester (pubkey (buff 33)) (id uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) ERR_NOT_AUTHORIZED)
    (asserts! (is-eq (len pubkey) u33) ERR_INVALID_PUBKEY)
    (asserts! (is-none (map-get? attester-by-id { id: id })) ERR_ATTESTER_EXISTS)
    (map-set attester-by-id { id: id } { pubkey: pubkey, active: true })
    (ok true)
  )
)

;; Update an attester's public key
;; Only the contract owner can update attesters
;; Allows changing the public key for an existing attester ID
;; 
;; @param pubkey - New compressed secp256k1 public key (33 bytes) for the attester
;; @param id - Unique identifier of the attester to update
;; @return (ok true) on success
;; @error ERR_NOT_AUTHORIZED (u1001) - If caller is not the contract owner
;; @error ERR_INVALID_PUBKEY (u1004) - If pubkey length is not 33 bytes
;; @error ERR_ATTESTER_NOT_FOUND (u1003) - If no attester exists with this ID
;; 
;; Side effects:
;; - Updates the pubkey for the specified attester
;; - Preserves the active status of the attester
(define-public (update-attester-pubkey (pubkey (buff 33)) (id uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) ERR_NOT_AUTHORIZED)
    (asserts! (is-eq (len pubkey) u33) ERR_INVALID_PUBKEY)
    (match (map-get? attester-by-id { id: id })
      attester (begin
        (map-set attester-by-id { id: id } { pubkey: pubkey, active: (get active attester) })
        (ok true)
      )
      ERR_ATTESTER_NOT_FOUND
    )
  )
)

;; Deactivate an attester in the registry
;; Only the contract owner can deactivate attesters
;; Deactivated attesters cannot issue new KYC credentials
;; 
;; @param id - Unique identifier of the attester to deactivate
;; @return (ok true) on success
;; @error ERR_NOT_AUTHORIZED (u1001) - If caller is not the contract owner
;; @error ERR_ATTESTER_NOT_FOUND (u1003) - If no attester exists with this ID
;; 
;; Side effects:
;; - Sets active: false for the specified attester
;; - Preserves the attester's pubkey (does not remove the entry)
(define-public (deactivate-attester (id uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) ERR_NOT_AUTHORIZED)
    (match (map-get? attester-by-id { id: id })
      attester (begin
        (map-set attester-by-id { id: id } { pubkey: (get pubkey attester), active: false })
        (ok true)
      )
      ERR_ATTESTER_NOT_FOUND
    )
  )
)

;; Check if an attester is currently active
;; 
;; @param id - Unique identifier of the attester to check
;; @return (ok true) if attester exists and is active
;; @return (ok false) if attester does not exist or is inactive
;; 
;; Note: This function does not throw errors - it returns false for non-existent attesters
(define-read-only (is-attester-active? (id uint))
  (match (map-get? attester-by-id { id: id })
    attester (ok (get active attester))
    (ok false)
  )
)

;; Get the public key of an attester
;; Used for verifying attestation signatures in KYC registration
;; 
;; @param id - Unique identifier of the attester
;; @return (ok (buff 33)) - Compressed secp256k1 public key (33 bytes)
;; @error ERR_ATTESTER_NOT_FOUND (u1003) - If no attester exists with this ID
;; 
;; Note: Returns pubkey regardless of active status (both active and inactive attesters have pubkeys)
(define-read-only (get-attester-pubkey (id uint))
  (match (map-get? attester-by-id { id: id })
    attester (ok (get pubkey attester))
    (err ERR_ATTESTER_NOT_FOUND)
  )
)

;; Get all attesters
;; Currently returns an empty list as a placeholder
;; 
;; @return (ok (list)) - Empty list (simplified implementation)
;; 
;; Note: In production, you might want to iterate through the map to return all attesters.
;; Clarity's non-Turing complete nature makes iteration complex, so this is a placeholder.
(define-read-only (get-attesters)
  (ok (list))
)