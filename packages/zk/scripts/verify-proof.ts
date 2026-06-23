import fs from 'fs';
import path from 'path';
import { artifactPaths, verifyProofOffchain } from '../src';

const packageRoot = path.resolve(__dirname, '..');
const buildDir = path.join(packageRoot, 'build');
const proofPath = path.join(buildDir, 'proof.json');
const publicPath = path.join(buildDir, 'public.json');

function readJson(filePath: string): any {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function bumpField(value: string): string {
  return (BigInt(value) + 1n).toString();
}

async function verify(publicSignals: string[], proof: any): Promise<boolean> {
  try {
    return await verifyProofOffchain(proof, publicSignals);
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  for (const requiredPath of [artifactPaths.vkeyPath, proofPath, publicPath]) {
    if (!fs.existsSync(requiredPath)) {
      throw new Error(`Missing ${requiredPath}. Run npm run zk:build and npm run zk:prove first.`);
    }
  }

  const proof = readJson(proofPath);
  const publicSignals = readJson(publicPath);

  const validProof = await verify(publicSignals, proof);
  console.log(`Valid proof: ${validProof ? 'OK' : 'FAILED'}`);

  const tamperedProof = JSON.parse(JSON.stringify(proof));
  tamperedProof.pi_a[0] = bumpField(tamperedProof.pi_a[0]);
  const tamperedProofAccepted = await verify(publicSignals, tamperedProof);
  console.log(`Tampered proof rejected: ${tamperedProofAccepted ? 'FAILED' : 'OK'}`);

  const tamperedPublicSignals = [...publicSignals];
  tamperedPublicSignals[0] = bumpField(tamperedPublicSignals[0]);
  const tamperedPublicInputAccepted = await verify(tamperedPublicSignals, proof);
  console.log(`Tampered public input rejected: ${tamperedPublicInputAccepted ? 'FAILED' : 'OK'}`);

  if (!validProof || tamperedProofAccepted || tamperedPublicInputAccepted) {
    process.exit(1);
  }

  process.exit(0);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
