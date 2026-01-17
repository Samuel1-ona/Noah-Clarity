(define-trait attester-registry-trait
  (
    ;; Check if attester is active
    (is-attester-active? (uint) (response bool uint))
    ;; Get attester public key
    (get-attester-pubkey (uint) (response (buff 33) uint))
  )
)