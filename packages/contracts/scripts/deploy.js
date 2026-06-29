/**
 * Zenta Soroban Contract Deployment Script
 * 
 * Deploys the zenta-verifier contract to Stellar testnet.
 * 
 * Prerequisites:
 *   1. Install Stellar CLI: https://developers.stellar.org/docs/tools/developer-tools/cli/install-cli
 *   2. Generate keypair: stellar keys generate zenta-deployer --network testnet
 *   3. Fund with Friendbot: stellar keys fund zenta-deployer --network testnet
 *   4. Build contract: cargo build --target wasm32-unknown-unknown --release
 *
 * Usage:
 *   node scripts/deploy.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WASM_PATH = path.join(
  __dirname, '..', 'zenta-verifier', 'target',
  'wasm32-unknown-unknown', 'release', 'zenta_verifier.wasm',
);

const NETWORK = process.env.STELLAR_NETWORK || 'testnet';
const SOURCE_ACCOUNT = process.env.STELLAR_SOURCE_ACCOUNT || 'zenta-deployer';

function run(cmd) {
  console.log('$', cmd);
  return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
}

async function main() {
  console.log('🚀 Deploying Zenta Verifier to Stellar', NETWORK);
  console.log('===========================================');

  // Check WASM exists
  if (!fs.existsSync(WASM_PATH)) {
    console.log('Building WASM contract first...');
    execSync('cargo build --target wasm32-unknown-unknown --release', {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
    });
  }

  // Optimize WASM
  const optimizedPath = WASM_PATH.replace('.wasm', '.optimized.wasm');
  try {
    run(`stellar contract optimize --wasm ${WASM_PATH}`);
    console.log('✓ WASM optimized');
  } catch {
    console.warn('⚠ stellar optimize failed, using unoptimized WASM');
  }

  // Upload WASM
  console.log('\nUploading WASM to', NETWORK, '...');
  const wasmToUpload = fs.existsSync(optimizedPath) ? optimizedPath : WASM_PATH;
  const uploadResult = run(
    `stellar contract upload --wasm ${wasmToUpload} --source ${SOURCE_ACCOUNT} --network ${NETWORK}`
  );
  const wasmHash = uploadResult.trim();
  console.log('✓ WASM hash:', wasmHash);

  // Deploy contract
  console.log('\nDeploying contract instance...');
  const deployResult = run(
    `stellar contract deploy --wasm-hash ${wasmHash} --source ${SOURCE_ACCOUNT} --network ${NETWORK}`
  );
  const contractId = deployResult.trim();
  console.log('✓ Contract ID:', contractId);

  // Get admin public key
  const adminKey = run(`stellar keys address ${SOURCE_ACCOUNT} --network ${NETWORK}`).trim();

  // Initialize contract
  console.log('\nInitializing contract with admin:', adminKey);
  run(
    `stellar contract invoke --id ${contractId} --source ${SOURCE_ACCOUNT} --network ${NETWORK} ` +
    `-- initialize --admin ${adminKey}`
  );
  console.log('✓ Contract initialized');

  // Save deployment info
  const deployInfo = {
    contractId,
    wasmHash,
    network: NETWORK,
    admin: adminKey,
    deployedAt: new Date().toISOString(),
  };
  const infoPath = path.join(__dirname, '..', 'deployment.json');
  fs.writeFileSync(infoPath, JSON.stringify(deployInfo, null, 2));

  console.log('\n✅ Deployment complete!');
  console.log('   Contract ID:', contractId);
  console.log('   Network:    ', NETWORK);
  console.log('   Info file:  ', infoPath);
  console.log('\n📝 Add to .env:');
  console.log(`   STELLAR_CONTRACT_ID=${contractId}`);
  console.log(`   STELLAR_NETWORK=${NETWORK}`);
  console.log('   VERIFICATION_MODE=STELLAR_REGISTRY_TESTNET');
}

main().catch(e => {
  console.error('❌ Deployment failed:', e.message);
  process.exit(1);
});
