;; Revocation Registry Contract
;; Manages Merkle tree roots for revoked credentials

(define-constant contract-owner tx-sender)

(define-data-var revocation-root (buff 32) 0x0000000000000000000000000000000000000000000000000000000000000000)
(define-data-var revocation-root-height uint u0)

(define-constant ERR_NOT_AUTHORIZED (err u3001))
(define-constant ERR_INVALID_ROOT (err u3002))

;; Update revocation Merkle root (only contract owner or attester)
;; This root represents the Merkle tree of all revoked credential commitments
(define-public (update-revocation-root (new-root (buff 32)))
  (begin
    (asserts! (is-eq tx-sender contract-owner) ERR_NOT_AUTHORIZED)
    (asserts! (is-eq (len new-root) u32) ERR_INVALID_ROOT)
    (var-set revocation-root new-root)
    (var-set revocation-root-height stacks-block-height)
    (ok true)
  )
)

;; Get current revocation root
(define-read-only (get-revocation-root)
  (ok (var-get revocation-root))
)

;; Get block height when root was last updated
(define-read-only (get-revocation-root-height)
  (ok (var-get revocation-root-height))
)

;; Check if a commitment is in the revocation tree
;; Note: This requires an off-chain Merkle proof to verify non-membership
;; The proof should be verified off-chain, then the result can be checked on-chain
(define-read-only (is-revoked? (commitment (buff 32)))
  ;; This is a placeholder - actual revocation checking requires Merkle proof verification
  ;; which is complex in Clarity. For now, we store the root and verify off-chain.
  (ok false)
)
