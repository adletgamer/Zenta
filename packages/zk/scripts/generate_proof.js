/**
 * Zenta ZK Proof Generation Script
 * 
 * Generates a Groth16 proof for a payroll calculation.
 * Usage: node scripts/generate_proof.js <input_json_path>
 *
 * Input JSON format:
 * {
 *   "operatorCodeHash": "1234...",
 *   "processedPairs": "15",
 *   "ratePerPair": "200",
 *   "bonus": "500",
 *   "penalty": "0",
 *   "expectedPayment": "3500",
 *   "nonce": "9876...",
 *   "commitment": "5555...",
 *   "periodHash": "7777..."
 * }
 *
 * Output: proof.json and public.json in build/
 */

const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');

const BUILD_DIR = path.join(__dirname, '..', 'build');
const WASM_PATH = path.join(BUILD_DIR, 'payroll_js', 'payroll.wasm');
const ZKEY_PATH = path.join(BUILD_DIR, 'payroll_final.zkey');

async function main() {
  const inputFile = process.argv[2];
  if (!inputFile) {
    console.error('Usage: node scripts/generate_proof.js <input.json>');
    console.error('\nExample input.json:');
    console.error(JSON.stringify({
      operatorCodeHash: '12345678901234567890',
      processedPairs: '15',
      ratePerPair: '200',
      bonus: '500',
      penalty: '0',
      expectedPayment: '3500',
      nonce: '98765432109876543210',
      commitment: '11111111111111111111',
      periodHash: '22222222222222222222',
    }, null, 2));
    process.exit(1);
  }

  if (!fs.existsSync(WASM_PATH) || !fs.existsSync(ZKEY_PATH)) {
    console.error('❌ Build files not found. Run `npm run compile && npm run setup` first.');
    process.exit(1);
  }

  const input = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  console.log('🔐 Generating Groth16 proof...');
  console.log('   Inputs:', Object.keys(input).join(', '));

  const startTime = Date.now();
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, WASM_PATH, ZKEY_PATH);
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  const proofPath = path.join(BUILD_DIR, 'proof.json');
  const publicPath = path.join(BUILD_DIR, 'public.json');
  fs.writeFileSync(proofPath, JSON.stringify(proof, null, 2));
  fs.writeFileSync(publicPath, JSON.stringify(publicSignals, null, 2));

  console.log(`\n✅ Proof generated in ${duration}s`);
  console.log('   Proof:   ', proofPath);
  console.log('   Public:  ', publicPath);
  console.log('\nPublic signals:', publicSignals);
}

main().catch(e => {
  console.error('❌ Proof generation failed:', e.message);
  process.exit(1);
});
