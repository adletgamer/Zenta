/**
 * Export Solidity verifier from Groth16 zkey
 * This serves as reference for implementing the Stellar Soroban contract verifier
 */
const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');

const BUILD_DIR = path.join(__dirname, '..', 'build');

async function main() {
  const zkeyPath = path.join(BUILD_DIR, 'payroll_final.zkey');
  if (!fs.existsSync(zkeyPath)) {
    console.error('Run setup first: npm run setup');
    process.exit(1);
  }
  try {
    const solidity = await snarkjs.zKey.exportSolidityVerifier(zkeyPath, {});
    const outPath = path.join(BUILD_DIR, 'PayrollVerifier.sol');
    fs.writeFileSync(outPath, solidity);
    console.log('✅ Solidity verifier exported to:', outPath);
    console.log('   Use this as reference for the Stellar Soroban verifier contract.');
  } catch(e) {
    console.error('Export failed:', e.message);
  }
}

main();
