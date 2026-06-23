import fs from 'fs';
import path from 'path';
import {
  PayrollCircuitInput,
  artifactPaths,
  generateProof,
  generateWitness,
  normalizePayrollCircuitInput,
  withPayrollCommitment,
} from '../src';

const packageRoot = path.resolve(__dirname, '..');
const buildDir = path.join(packageRoot, 'build');
const validInputPath = path.join(packageRoot, 'inputs', 'valid-payroll.input.json');
const invalidInputPath = path.join(packageRoot, 'inputs', 'invalid-payroll.input.json');
const tamperedExpectedInputPath = path.join(packageRoot, 'inputs', 'invalid-payroll-tampered-expected.input.json');

function readInput(filePath: string): PayrollCircuitInput {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function assertInputFails(input: PayrollCircuitInput, label: string): Promise<void> {
  try {
    await generateProof(await withPayrollCommitment(input));
  } catch {
    console.log(`${label}: OK`);
    return;
  }

  throw new Error(`${label} unexpectedly generated a proof`);
}

async function main(): Promise<void> {
  for (const requiredPath of [artifactPaths.wasmPath, artifactPaths.zkeyPath]) {
    if (!fs.existsSync(requiredPath)) {
      throw new Error(`Missing ${requiredPath}. Run npm run zk:build first.`);
    }
  }

  const inputPath = process.argv[2] ? path.resolve(process.argv[2]) : validInputPath;
  const proofPath = path.join(buildDir, 'proof.json');
  const publicPath = path.join(buildDir, 'public.json');
  const hydratedInputPath = path.join(buildDir, 'payroll.input.json');

  const validInput = await withPayrollCommitment(readInput(inputPath));
  fs.writeFileSync(hydratedInputPath, JSON.stringify(validInput, null, 2));

  const start = Date.now();
  await generateWitness(validInput);
  const { proof, publicSignals } = await generateProof(normalizePayrollCircuitInput(validInput));
  const durationSeconds = ((Date.now() - start) / 1000).toFixed(2);

  fs.writeFileSync(proofPath, JSON.stringify(proof, null, 2));
  fs.writeFileSync(publicPath, JSON.stringify(publicSignals, null, 2));

  console.log(`Proof generated: OK (${durationSeconds}s)`);
  console.log(`Public signals: ${publicSignals.join(', ')}`);

  if (fs.existsSync(invalidInputPath)) {
    await assertInputFails(readInput(invalidInputPath), 'Invalid penalty input rejected');
  }

  if (fs.existsSync(tamperedExpectedInputPath)) {
    await assertInputFails(readInput(tamperedExpectedInputPath), 'Tampered expected_payment rejected');
  }

  process.exit(0);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
