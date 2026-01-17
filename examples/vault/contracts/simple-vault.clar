;; title: Simple Vault
;; version: 1.0.0
;; summary: A simple STX vault contract with deposit and withdraw functionality
;; description: Allows users to deposit and withdraw STX from their personal balance

;; User balances
(define-map balances { user: principal } { amount: uint })

;; Constants
(define-constant ERR_INSUFFICIENT_BALANCE (err u1001))
(define-constant ERR_INVALID_AMOUNT (err u1002))

;; @desc Allows users to deposit STX into the vault
;; @param amount (uint) - The amount of STX to deposit (in micro-STX)
;; @returns (response bool uint) - (ok true) if deposit succeeds, (err uint) on error
(define-public (deposit (amount uint))
  (begin
    (asserts! (> amount u0) ERR_INVALID_AMOUNT)
    
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
    
    (match (map-get? balances { user: tx-sender })
      existing-balance (begin
        (let ((new-balance (+ amount (get amount existing-balance))))
          (map-set balances { user: tx-sender } { amount: new-balance })
          (ok true)
        )
      )
      (begin
        (map-set balances { user: tx-sender } { amount: amount })
        (ok true)
      )
    )
  )
)

;; @desc Allows users to withdraw their deposited STX from the vault
;; @param amount (uint) - The amount of STX to withdraw (in micro-STX)
;; @returns (response bool uint) - (ok true) if withdrawal succeeds, (err uint) on error
(define-public (withdraw (amount uint))
  (begin
    (asserts! (> amount u0) ERR_INVALID_AMOUNT)
    
    (match (map-get? balances { user: tx-sender })
      user-balance (begin
        (let ((balance (get amount user-balance)))
          (asserts! (>= balance amount) ERR_INSUFFICIENT_BALANCE)
          
          (let ((new-balance (- balance amount)))
            (map-set balances { user: tx-sender } { amount: new-balance })
            (try! (as-contract (stx-transfer? amount (as-contract tx-sender) tx-sender)))
            (ok true)
          )
        )
      )
      ERR_INSUFFICIENT_BALANCE
    )
  )
)

;; @desc Returns the balance of a user
;; @param user (principal) - The user to check
;; @returns (response uint uint) - (ok uint) with the user's balance, or (ok u0) if no balance
(define-read-only (get-balance (user principal))
  (match (map-get? balances { user: user })
    user-balance (ok (get amount user-balance))
    (ok u0)
  )
)
