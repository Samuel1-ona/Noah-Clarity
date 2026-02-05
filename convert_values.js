const { mimcHash, mimc7 } = require('./packages/noah-sdk/dist/mimc');

function hash(vals) {
    return mimcHash(vals.map(v => BigInt(v)));
}

// Common test addresses or values
const addr = "ST2N04CYE3CQ1S354MZX4KHYJYD4QW25ZW37GQY7J";
// Simple test address
const addrNumeric = "123456789";

console.log("Addr Numeric (hex):", BigInt(addrNumeric).toString(16));

const v1 = BigInt("9602141931912223866163071931416789454832550115569015537893937028105755626437");
const v2 = BigInt("17326107812863979978944924376181715788118846925194825369170105604266665665875");

console.log("\nFailing values:");
console.log("v1 (hex expected):", v1.toString(16));
console.log("v2 (hex actual):", v2.toString(16));

// Check if v1 or v2 is a hash of some simple values
// commitment = Hash(ID, Nonce, Addr)
// ID = hash(addr)
// nonce = random
// This is hard to check without the real values.
