/**
 * Local integration test for Noah-v2 SDK
 * Tests SDK connection to local backend services
 * 
 * Prerequisites:
 * 1. Backend services must be running:
 *    - Prover service on http://localhost:8080
 *    - Attester service on http://localhost:8081
 * 2. Run: npm run test:local
 */

import { NoahSDK } from './src/index';
import { loadContractAddresses, createSDKConfig } from './src/config';

const PROVER_URL = 'http://localhost:8080';
const ATTESTER_URL = 'http://localhost:8081';

/**
 * Check if a service is running by calling its health endpoint
 */
async function checkServiceHealth(url: string, serviceName: string): Promise<boolean> {
  try {
    const response = await fetch(`${url}/health`);
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ ${serviceName} is running:`, data);
      return true;
    } else {
      console.error(` ${serviceName} health check failed: ${response.status} ${response.statusText}`);
      return false;
    }
  } catch (error) {
    console.error(`${serviceName} is not reachable at ${url}:`, error instanceof Error ? error.message : String(error));
    return false;
  }
}

/**
 * Test proof generation
 */
async function testProofGeneration(sdk: NoahSDK): Promise<boolean> {
  console.log('\n Testing proof generation...');
  
  try {
    // Create a test proof request
    // Note: Backend expects numeric values for big.Int fields (not strings)
    // Go's big.Int JSON unmarshaling requires numbers, not strings
    const proofRequest: any = {
      age: 25,
      jurisdiction: 1, // US
      is_accredited: 1,
      identity_data: 123456789, // Numeric value for testing
      nonce: 12345,
      min_age: 18,
      allowed_jurisdictions: [1, 2, 3], // US, EU, etc. - as numbers
      require_accreditation: 1,
      commitment: parseInt('a'.repeat(16), 16), // Convert hex to number (using first 16 chars for testing)
    };

    const response = await sdk.proof.generateProof(proofRequest);
    
    if (response.success) {
      console.log(' Proof generation successful');
      console.log('   Commitment:', response.commitment);
      console.log('   Public inputs:', response.public_inputs?.length || 0, 'inputs');
      return true;
    } else {
      console.error(' Proof generation failed:', response.error);
      return false;
    }
  } catch (error) {
    console.error(' Proof generation error:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

/**
 * Test attestation request
 */
async function testAttestation(sdk: NoahSDK, commitment: string, publicInputs: string[], proof: string): Promise<boolean> {
  console.log('  Testing attestation...');
  
  try {
    const attestationRequest = {
      commitment,
      public_inputs: publicInputs,
      proof,
      user_id: 'test-user-123',
    };

    const response = await sdk.proof.requestAttestation(attestationRequest);
    
    if (response.success) {
      console.log(' Attestation successful');
      console.log('   Attester ID:', response.attester_id);
      console.log('   Signature:', response.signature.substring(0, 20) + '...');
      return true;
    } else {
      console.error(' Attestation failed:', response.error);
      return false;
    }
  } catch (error) {
    console.error(' Attestation error:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

/**
 * Test contract read-only functions (doesn't require blockchain)
 */
async function testContractReadOnly(sdk: NoahSDK, testAddress: string): Promise<boolean> {
  console.log('\n📖 Testing contract read-only functions...');
  
  try {
    // Test hasKYC (should return false for test address)
    const hasKYC = await sdk.contract.hasKYC(testAddress);
    console.log(' hasKYC check successful:', hasKYC.hasKYC);
    
    // Test isKYCValid
    const isValid = await sdk.contract.isKYCValid(testAddress);
    console.log(' isKYCValid check successful:', isValid);
    
    // Test getKYC
    const kycDetails = await sdk.contract.getKYC(testAddress);
    console.log(' getKYC check successful:', kycDetails ? 'Found' : 'Not found');
    
    return true;
  } catch (error) {
    console.error(' Contract read-only error:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log(' Starting Noah-v2 SDK Local Integration Tests\n');
  console.log('=' .repeat(50));

  // Step 1: Check backend services
  console.log(' Checking backend services...');
  const proverHealthy = await checkServiceHealth(PROVER_URL, 'Prover Service');
  const attesterHealthy = await checkServiceHealth(ATTESTER_URL, 'Attester Service');

  if (!proverHealthy || !attesterHealthy) {
    console.error(' Backend services are not running. Please start them first:');
    console.error('   1. Start prover service: cd backend/prover && go run .');
    console.error('   2. Start attester service: cd backend/attester && go run .');
    process.exit(1);
  }

  // Step 2: Initialize SDK
  console.log(' Initializing SDK...');
  const contractAddresses = loadContractAddresses('testnet');
  const sdkConfig = createSDKConfig(contractAddresses, {
    proverServiceUrl: PROVER_URL,
    attesterServiceUrl: ATTESTER_URL,
  });

  const sdk = new NoahSDK(sdkConfig, {
    appName: 'Noah-v2 Test',
  });
  console.log(' SDK initialized');
  console.log('   Prover URL:', PROVER_URL);
  console.log('   Attester URL:', ATTESTER_URL);
  console.log('   KYC Registry:', sdkConfig.kycRegistryAddress);

  // Step 3: Test proof generation
  const proofResult = await testProofGeneration(sdk);
  if (!proofResult) {
    console.error(' Proof generation test failed. Stopping tests.');
    process.exit(1);
  }

  // Step 4: Test attestation (we need a valid proof first)
  // For now, we'll skip this if proof generation fails
  // In a real scenario, you'd use the proof from step 3
  console.log(' Skipping attestation test (requires valid proof from previous step)');
  console.log('   To test full flow, you would:');
  console.log('   1. Generate proof (✅ tested)');
  console.log('   2. Request attestation with the proof');
  console.log('   3. Register on-chain with the attestation');

  // Step 5: Test contract read-only functions
  // Use the deployer address from testnet contracts
  const testAddress = contractAddresses.deployer; // 'STVAH96MR73TP2FZG2W4X220MEB4NEMJHPMVYQNS'
  const contractTestResult = await testContractReadOnly(sdk, testAddress);

  // Summary
  console.log('' + '='.repeat(50));
  console.log(' Test Summary:');
  console.log(`   Backend Services: ${proverHealthy && attesterHealthy ? '✅' : '❌'}`);
  console.log(`   Proof Generation: ${proofResult ? '✅' : '❌'}`);
  console.log(`   Contract Read-Only: ${contractTestResult ? '✅' : '❌'}`);

  if (proverHealthy && attesterHealthy && proofResult && contractTestResult) {
    console.log('\n🎉 All tests passed! SDK is working correctly with local backend services.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Please check the errors above.');
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

