/**
 * Zenta ZK Setup Script
 * 
 * Performs the Groth16 trusted setup:
 * 1. Download Powers of Tau ceremony file (hermez bn128 12)
 * 2. Generate circuit-specific proving key
 * 3. Export verification key JSON
 * 4. Export Solidity/Rust verifier
 *
 * Run: node scripts/setup.js
 * Requires: circom must be installed and circuit compiled first
 *   $ npm run compile
 *   $ node scripts/setup.js
 */

const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');
const https = require('https');

const BUILD_DIR = path.join(__dirname, '..', 'build');
const PTAU_URL = 'https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_12.ptau';
const PTAU_PATH = path.join(BUILD_DIR, 'pot12_final.ptau');
const R1CS_PATH = path.join(BUILD_DIR, 'payroll.r1cs');
const ZKEY_0_PATH = path.join(BUILD_DIR, 'payroll_0000.zkey');
const ZKEY_FINAL_PATH = path.join(BUILD_DIR, 'payroll_final.zkey');
const VKEY_PATH = path.join(BUILD_DIR, 'verification_key.json');

async function downloadFile(url, dest) {
  if (fs.existsSync(dest)) {
    console.log(`  [skip] ${path.basename(dest)} already exists`);
    return;
  }
  return new Promise((resolve, reject) => {
    console.log(`  Downloading ${path.basename(dest)} from ${url}...`);
    const file = fs.createWriteStream(dest);
    https.get(url, response => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      }
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', reject);
  });
}

async function main() {
  console.log('\n🔑 Zenta ZK Trusted Setup');
  console.log('=========================');
  console.log('Circuit: payroll.circom (Groth16 / BN128)');
  console.log('');

  // Ensure build directory exists
  if (!fs.existsSync(BUILD_DIR)) {
    fs.mkdirSync(BUILD_DIR, { recursive: true });
  }

  // Check r1cs exists (must compile circuit first)
  if (!fs.existsSync(R1CS_PATH)) {
    console.error('❌ payroll.r1cs not found. Run `npm run compile` first:');
    console.error('   circom circuits/payroll.circom --r1cs --wasm --sym --output build');
    console.error('   Requires: circom installed (https://docs.circom.io/getting-started/installation/)');
    process.exit(1);
  }

  // Step 1: Download Powers of Tau
  console.log('Step 1: Powers of Tau ceremony file');
  await downloadFile(PTAU_URL, PTAU_PATH);
  console.log('  ✓ Powers of Tau ready');

  // Step 2: Initial setup (circuit-specific)
  console.log('\nStep 2: Circuit-specific setup (Groth16 phase 2)');
  await snarkjs.zKey.newZKey(R1CS_PATH, PTAU_PATH, ZKEY_0_PATH);
  console.log('  ✓ Initial zkey created');

  // Step 3: Contribute randomness (in production, multiple parties contribute)
  console.log('\nStep 3: Adding contribution randomness');
  await snarkjs.zKey.contribute(
    ZKEY_0_PATH,
    ZKEY_FINAL_PATH,
    'Zenta MVP Contributor',
    // Random entropy
    require('crypto').randomBytes(32).toString('hex'),
  );
  console.log('  ✓ Contribution added');

  // Step 4: Export verification key
  console.log('\nStep 4: Exporting verification key');
  const vKey = await snarkjs.zKey.exportVerificationKey(ZKEY_FINAL_PATH);
  fs.writeFileSync(VKEY_PATH, JSON.stringify(vKey, null, 2));
  console.log('  ✓ Verification key exported to:', VKEY_PATH);

  // Step 5: Export Solidity verifier (for Stellar contract reference)
  const solidityPath = path.join(BUILD_DIR, 'PayrollVerifier.sol');
  console.log('\nStep 5: Exporting Solidity verifier template');
  try {
    const solidity = await snarkjs.zKey.exportSolidityVerifier(ZKEY_FINAL_PATH, {
      groth16Template: undefined,
    });
    fs.writeFileSync(solidityPath, solidity);
    console.log('  ✓ Solidity verifier exported (reference for Stellar contract)');
  } catch (e) {
    console.warn('  ⚠ Solidity export skipped:', e.message);
  }

  // Print circuit info
  const r1csInfo = await snarkjs.r1cs.info(R1CS_PATH);
  console.log('\n📊 Circuit Stats:');
  console.log(`   Constraints: ${r1csInfo.nConstraints}`);
  console.log(`   Public inputs: ${r1csInfo.nPublic}`);
  console.log(`   Private inputs: ${r1csInfo.nVars - r1csInfo.nPublic}`);

  console.log('\n✅ ZK Setup complete!');
  console.log('   Proving key:      ', ZKEY_FINAL_PATH);
  console.log('   Verification key: ', VKEY_PATH);
  console.log('\n💡 Next steps:');
  console.log('   1. Copy ZKEY_FINAL_PATH to apps/api/build/ or set ZK_ZKEY_PATH in .env');
  console.log('   2. Copy VKEY_PATH to apps/api/build/ or set ZK_VKEY_PATH in .env');
  console.log('   3. Run the API: npm run dev:api');
}

main().catch(e => {
  console.error('❌ Setup failed:', e);
  process.exit(1);
});
