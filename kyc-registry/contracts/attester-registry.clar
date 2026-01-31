;; Attester Registry Contract
;; Manages trusted attesters (KYC providers) who can issue credentials

;; Owner of the contract
(define-data-var contract-owner principal tx-sender)

;; Map of attesters by ID
;; Added: address field to store the principal of the attester
(define-map attester-by-id { id: uint } { pubkey: (buff 33), active: bool, address: principal })

;; List of all registered attester IDs
;; Added: for on-chain discovery
(define-data-var attesters-list (list 1000 uint) (list))

(define-constant ERR_NOT_AUTHORIZED (err u1001))
(define-constant ERR_ATTESTER_EXISTS (err u1002))
(define-constant ERR_ATTESTER_NOT_FOUND (err u1003))
(define-constant ERR_INVALID_PUBKEY (err u1004))

;; Add a new attester to the registry
;; Only the contract owner can add new attesters
;; 
;; @param pubkey - Compressed secp256k1 public key (33 bytes) of the attester
;; @param id - Unique identifier for the attester
;; @param address - Stacks principal address of the attester
;; @return (ok true) on success
(define-public (add-attester (pubkey (buff 33)) (id uint) (address principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR_NOT_AUTHORIZED)
    (asserts! (is-eq (len pubkey) u33) ERR_INVALID_PUBKEY)
    (asserts! (is-none (map-get? attester-by-id { id: id })) ERR_ATTESTER_EXISTS)
    
    ;; Store attester details
    (map-set attester-by-id { id: id } { pubkey: pubkey, active: true, address: address })
    
    ;; Add to discovery list
    (var-set attesters-list (unwrap-panic (as-max-len? (append (var-get attesters-list) id) u1000)))
    (ok true)
  )
)

;; Update an attester's public key
(define-public (update-attester-pubkey (pubkey (buff 33)) (id uint))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR_NOT_AUTHORIZED)
    (asserts! (is-eq (len pubkey) u33) ERR_INVALID_PUBKEY)
    (match (map-get? attester-by-id { id: id })
      attester (begin
        (map-set attester-by-id { id: id } 
          { 
            pubkey: pubkey, 
            active: (get active attester),
            address: (get address attester)
          })
        (ok true)
      )
      ERR_ATTESTER_NOT_FOUND
    )
  )
)

;; Update an attester's address
(define-public (update-attester-address (address principal) (id uint))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR_NOT_AUTHORIZED)
    (match (map-get? attester-by-id { id: id })
      attester (begin
        (map-set attester-by-id { id: id } 
          { 
            pubkey: (get pubkey attester), 
            active: (get active attester),
            address: address
          })
        (ok true)
      )
      ERR_ATTESTER_NOT_FOUND
    )
  )
)

;; Deactivate an attester in the registry
(define-public (deactivate-attester (id uint))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR_NOT_AUTHORIZED)
    (match (map-get? attester-by-id { id: id })
      attester (begin
        (map-set attester-by-id { id: id } 
          { 
            pubkey: (get pubkey attester), 
            active: false,
            address: (get address attester)
          })
        (ok true)
      )
      ERR_ATTESTER_NOT_FOUND
    )
  )
)

;; Transfer ownership of the contract
(define-public (transfer-ownership (new-owner principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR_NOT_AUTHORIZED)
    (var-set contract-owner new-owner)
    (ok true)
  )
)

;; Read-only functions

(define-read-only (is-attester-active? (id uint))
  (match (map-get? attester-by-id { id: id })
    attester (ok (get active attester))
    (ok false)
  )
)

(define-read-only (get-attester-pubkey (id uint))
  (match (map-get? attester-by-id { id: id })
    attester (ok (get pubkey attester))
    (err ERR_ATTESTER_NOT_FOUND)
  )
)

(define-read-only (get-attester-address (id uint))
  (match (map-get? attester-by-id { id: id })
    attester (ok (get address attester))
    (err ERR_ATTESTER_NOT_FOUND)
  )
)

;; Get all registered attesters (for discovery)
(define-read-only (get-attesters)
  (ok (var-get attesters-list))
)

(define-read-only (get-contract-owner)
  (ok (var-get contract-owner))
)