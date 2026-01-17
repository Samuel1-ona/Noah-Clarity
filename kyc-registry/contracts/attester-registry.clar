;; Attester Registry Contract
;; Manages trusted attesters (KYC providers) who can issue credentials

(define-constant contract-owner tx-sender)

(define-map attester-by-id { id: uint } { pubkey: (buff 33), active: bool })

(define-constant ERR_NOT_AUTHORIZED (err u1001))
(define-constant ERR_ATTESTER_EXISTS (err u1002))
(define-constant ERR_ATTESTER_NOT_FOUND (err u1003))
(define-constant ERR_INVALID_PUBKEY (err u1004))

;; Add a new attester (only contract owner)
(define-public (add-attester (pubkey (buff 33)) (id uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) ERR_NOT_AUTHORIZED)
    (asserts! (is-eq (len pubkey) u33) ERR_INVALID_PUBKEY)
    (asserts! (is-none (map-get? attester-by-id { id: id })) ERR_ATTESTER_EXISTS)
    (map-set attester-by-id { id: id } { pubkey: pubkey, active: true })
    (ok true)
  )
)

;; Deactivate an attester
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

;; Check if attester is active
(define-read-only (is-attester-active? (id uint))
  (match (map-get? attester-by-id { id: id })
    attester (ok (get active attester))
    (ok false)
  )
)

;; Get attester public key
(define-read-only (get-attester-pubkey (id uint))
  (match (map-get? attester-by-id { id: id })
    attester (ok (get pubkey attester))
    (err ERR_ATTESTER_NOT_FOUND)
  )
)

;; Get all attesters (simplified - returns empty list)
;; In production, you might want to iterate through the map
(define-read-only (get-attesters)
  (ok (list))
)