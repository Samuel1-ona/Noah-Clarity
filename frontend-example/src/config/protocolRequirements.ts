/**
 * Protocol Requirements Configuration
 * Protocols define their KYC requirements off-chain (in JSON/metadata/API)
 * This is more scalable than storing on-chain - requirements can change without transactions
 * 
 * NO BACKEND REQUIRED! Options include:
 * 1. Static JSON file (this file or external JSON)
 * 2. Frontend config (code/config file)
 * 3. IPFS (decentralized, no backend)
 * 4. CDN-hosted file (static file hosting)
 * 5. API endpoint (only if you want dynamic updates)
 */

import type { ProtocolRequirements } from 'noah-clarity';

/**
 * Vault Protocol Requirements
 * 
 * Option 1: Static Config (Current Approach - No Backend Needed)
 * Requirements are defined in code/config file
 * Pros: Simple, no infrastructure, works immediately
 * Cons: Requires code deployment to update
 */
export const VAULT_PROTOCOL_REQUIREMENTS: ProtocolRequirements = {
  min_age: 18,
  allowed_jurisdictions: [1, 2, 3], // US (1), EU (2), UK (3)
  require_accreditation: false,
};

/**
 * Get protocol requirements for a given protocol
 * 
 * This function can fetch from various sources (none require a backend):
 * 
 * Option 1: Static Config (Current - No Backend)
 *   return VAULT_PROTOCOL_REQUIREMENTS;
 * 
 * Option 2: External JSON File (No Backend)
 *   const response = await fetch('/requirements/vault.json');
 *   return await response.json();
 * 
 * Option 3: IPFS (Decentralized - No Backend)
 *   const response = await fetch(`https://ipfs.io/ipfs/${ipfsHash}`);
 *   return await response.json();
 * 
 * Option 4: CDN (Static Hosting - No Backend)
 *   const response = await fetch('https://cdn.example.com/vault/requirements.json');
 *   return await response.json();
 * 
 * Option 5: API Endpoint (Requires Backend - Only if you need dynamic updates)
 *   const response = await fetch('https://api.vault.com/requirements');
 *   return await response.json();
 */
export async function getProtocolRequirements(protocolName: string): Promise<ProtocolRequirements> {
  // Option 1: Static Config (Current - No Backend Needed)
  switch (protocolName) {
    case 'vault':
      return VAULT_PROTOCOL_REQUIREMENTS;
    default:
      // Default requirements (fallback)
      return {
        min_age: 18,
        allowed_jurisdictions: [1, 2, 3],
        require_accreditation: false,
      };
  }

  // Option 2: Fetch from External JSON File (No Backend)
  // Uncomment to use:
  // try {
  //   const response = await fetch(`/requirements/${protocolName}.json`);
  //   if (response.ok) {
  //     return await response.json();
  //   }
  // } catch (error) {
  //   console.error('Failed to fetch requirements:', error);
  // }

  // Option 3: Fetch from IPFS (No Backend)
  // Uncomment to use:
  // try {
  //   const ipfsHash = 'QmYourIPFSHashHere';
  //   const response = await fetch(`https://ipfs.io/ipfs/${ipfsHash}`);
  //   return await response.json();
  // } catch (error) {
  //   console.error('Failed to fetch from IPFS:', error);
  // }

  // Option 4: Fetch from CDN (No Backend)
  // Uncomment to use:
  // try {
  //   const response = await fetch(`https://cdn.example.com/${protocolName}/requirements.json`);
  //   return await response.json();
  // } catch (error) {
  //   console.error('Failed to fetch from CDN:', error);
  // }

  // Option 5: Fetch from API (Requires Backend)
  // Only use if you need dynamic, real-time updates
  // try {
  //   const response = await fetch(`https://api.example.com/protocols/${protocolName}/requirements`);
  //   return await response.json();
  // } catch (error) {
  //   console.error('Failed to fetch from API:', error);
  // }
}

/**
 * Human-readable jurisdiction names
 */
export const JURISDICTION_NAMES: Record<number, string> = {
  1: 'United States',
  2: 'European Union',
  3: 'United Kingdom',
  4: 'Canada',
  5: 'Australia',
};
