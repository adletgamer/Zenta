import fs from 'fs';
import path from 'path';
import {
  PayrollCircuitInput,
  artifactPaths,
  generateProof,
  verifyProofOffchain,
  withPayrollCommitment,
} from '../src';

const packageRoot = path.resolve(__dirname, '..');
const validInputPath = path.join(packageRoot, 'inputs', 'valid-payroll.input.json');
const invalidInputPath = path.join(packageRoot, 'inputs', 'invalid-payroll.input.json');
const tamperedExpectedInputPath = path.join(packageRoot, 'inputs', 'invalid-payroll-tampered-expected.input.json');

function readInput(filePath: string): PayrollCircuitInput {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function bumpField(value: string): string {
  return (BigInt(value) + 1n).toString();
}

async function expectProofGenerationToFail(input: PayrollCircuitInput, label: string): Promise<void> {
  try {
    await generateProof(await withPayrollCommitment(input));
  } catch {
    console.log(`${label}: OK`);
    return;
  }

  throw new Error(`${label}: proof generation unexpectedly succeeded`);
}

async function main(): Promise<void> {
  for (const requiredPath of [artifactPaths.wasmPath, artifactPaths.zkeyPath, artifactPaths.vkeyPath]) {
    if (!fs.existsSync(requiredPath)) {
      throw new Error(`Missing ${requiredPath}. Run npm run zk:build first.`);
    }
  }

  const validInput = await withPayrollCommitment(readInput(validInputPath));
  const { proof, publicSignals } = await generateProof(validInput);
  const valid = await verifyProofOffchain(proof, publicSignals);
  console.log(`Valid proof verifies off-chain: ${valid ? 'OK' : 'FAILED'}`);

  await expectProofGenerationToFail(readInput(invalidInputPath), 'Invalid payroll rejected');
  await expectProofGenerationToFail(readInput(tamperedExpectedInputPath), 'Tampered expected_payment rejected');

  const tamperedSignals = [...publicSignals];
  tamperedSignals[0] = bumpField(tamperedSignals[0]);
  const tamperedAccepted = await verifyProofOffchain(proof, tamperedSignals);
  console.log(`Tampered public signal rejected: ${tamperedAccepted ? 'FAILED' : 'OK'}`);

  if (!valid || tamperedAccepted) {
    process.exit(1);
  }

  process.exit(0);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
