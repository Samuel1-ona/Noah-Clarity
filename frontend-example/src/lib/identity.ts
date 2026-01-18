/**
 * Identity utilities for converting addresses to numeric values
 */

/**
 * Convert a Stacks address (or any string) to a numeric value
 * Uses a simple hash function to convert the string to a consistent numeric value
 * 
 * @param address - The Stacks address or identity string
 * @returns Numeric string representation (for use with big.Int)
 */
export function addressToNumeric(address: string): string {
  // Simple hash function: sum of character codes
  // This provides a deterministic numeric value from the address
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    const char = address.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Ensure positive value
  return Math.abs(hash).toString();
}

/**
 * Generate a numeric nonce for use in ZK proofs
 * Returns a random numeric string that can be parsed as big.Int
 * 
 * @returns Numeric string representation of a random number
 */
export function generateNumericNonce(): string {
  // Generate a random number using timestamp and random number
  // This ensures uniqueness while keeping it numeric
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000000);
  return (timestamp * 1000000 + random).toString();
}

