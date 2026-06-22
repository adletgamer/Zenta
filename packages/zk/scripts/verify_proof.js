/**
 * Zenta ZK Proof Verification Script
 * Usage: node scripts/verify_proof.js
 * Reads build/proof.json and build/public.json
 */

const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');

const BUILD_DIR = path.join(__dirname, '..', 'build');
const VKEY_PATH = path.join(BUILD_DIR, 'verification_key.json');
const PROOF_PATH = path.join(BUILD_DIR, 'proof.json');
const PUBLIC_PATH = path.join(BUILD_DIR, 'public.json');

async function main() {
  for (const p of [VKEY_PATH, PROOF_PATH, PUBLIC_PATH]) {
    if (!fs.existsSync(p)) {
      console.error(`❌ File not found: ${p}`);
      process.exit(1);
    }
  }

  const vKey = JSON.parse(fs.readFileSync(VKEY_PATH, 'utf8'));
  const proof = JSON.parse(fs.readFileSync(PROOF_PATH, 'utf8'));
  const publicSignals = JSON.parse(fs.readFileSync(PUBLIC_PATH, 'utf8'));

  console.log('🔍 Verifying Groth16 proof...');
  console.log('   Public signals:', publicSignals);

  const result = await snarkjs.groth16.verify(vKey, publicSignals, proof);

  if (result) {
    console.log('\n✅ PROOF VALID — Payroll calculation verified!');
    console.log('   The payment formula is correct for the given commitment.');
  } else {
    console.log('\n❌ PROOF INVALID — Verification failed!');
    process.exit(1);
  }
}

main().catch(e => {
  console.error('❌ Verification failed:', e.message);
  process.exit(1);
});
