import fs from 'fs';
import https from 'https';
import path from 'path';
import { spawnSync } from 'child_process';
import { PayrollCircuitInput, normalizePayrollCircuitInput, withPayrollCommitment } from './commitmentBuilder';

const snarkjs = require('snarkjs');

export interface ZkArtifactPaths {
  packageRoot: string;
  buildDir: string;
  circuitPath: string;
  r1csPath: string;
  wasmPath: string;
  zkeyPath: string;
  vkeyPath: string;
  witnessPath: string;
  ptauPath: string;
}

export interface GenerateProofResult {
  proof: Record<string, unknown>;
  publicSignals: string[];
}

export const packageRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(packageRoot, '..', '..');
const buildDir = path.join(packageRoot, 'build');
const ptauUrl = 'https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_12.ptau';

export const artifactPaths: ZkArtifactPaths = {
  packageRoot,
  buildDir,
  circuitPath: path.join(packageRoot, 'circuits', 'payroll.circom'),
  r1csPath: path.join(buildDir, 'payroll.r1cs'),
  wasmPath: path.join(buildDir, 'payroll_js', 'payroll.wasm'),
  zkeyPath: path.join(buildDir, 'payroll_final.zkey'),
  vkeyPath: path.join(buildDir, 'verification_key.json'),
  witnessPath: path.join(buildDir, 'witness.wtns'),
  ptauPath: path.join(buildDir, 'pot12_final.ptau'),
};

function commandName(name: string): string {
  return process.platform === 'win32' ? `${name}.cmd` : name;
}

function findCircom(): string {
  if (process.env.CIRCOM_BIN) {
    return process.env.CIRCOM_BIN;
  }

  const localBinary = path.join(
    repoRoot,
    'circom',
    'target',
    'release',
    process.platform === 'win32' ? 'circom.exe' : 'circom',
  );

  if (fs.existsSync(localBinary)) {
    return localBinary;
  }

  return 'circom';
}

function run(command: string, args: string[], cwd = packageRoot): void {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32' && command.endsWith('.cmd'),
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }
}

function download(url: string, destination: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destination);
    https
      .get(url, response => {
        if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          file.close();
          fs.rmSync(destination, { force: true });
          download(response.headers.location, destination).then(resolve, reject);
          return;
        }

        if (response.statusCode !== 200) {
          file.close();
          fs.rmSync(destination, { force: true });
          reject(new Error(`Failed to download PTAU: HTTP ${response.statusCode}`));
          return;
        }

        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      })
      .on('error', error => {
        file.close();
        fs.rmSync(destination, { force: true });
        reject(error);
      });
  });
}

export async function buildCircuit(): Promise<ZkArtifactPaths> {
  fs.mkdirSync(buildDir, { recursive: true });

  for (const generatedPath of [
    artifactPaths.r1csPath,
    path.join(buildDir, 'payroll_0000.zkey'),
    artifactPaths.zkeyPath,
    artifactPaths.vkeyPath,
    path.join(buildDir, 'payroll.sym'),
    artifactPaths.witnessPath,
  ]) {
    fs.rmSync(generatedPath, { force: true });
  }
  fs.rmSync(path.join(buildDir, 'payroll_js'), { recursive: true, force: true });

  console.log('Building payroll circuit...');
  run(findCircom(), [artifactPaths.circuitPath, '--r1cs', '--wasm', '--sym', '--output', buildDir]);

  if (!fs.existsSync(artifactPaths.ptauPath)) {
    console.log('Downloading Powers of Tau...');
    await download(ptauUrl, artifactPaths.ptauPath);
  }

  const zkey0Path = path.join(buildDir, 'payroll_0000.zkey');

  console.log('Generating Groth16 proving key...');
  run(commandName('npx'), ['snarkjs', 'groth16', 'setup', artifactPaths.r1csPath, artifactPaths.ptauPath, zkey0Path]);

  console.log('Contributing deterministic dev entropy...');
  run(commandName('npx'), [
    'snarkjs',
    'zkey',
    'contribute',
    zkey0Path,
    artifactPaths.zkeyPath,
    '--name=ZentaPayrollDevContributor',
    '-v',
    '-e=zenta-payroll-v1-dev-entropy',
  ]);

  console.log('Exporting verification key...');
  run(commandName('npx'), ['snarkjs', 'zkey', 'export', 'verificationkey', artifactPaths.zkeyPath, artifactPaths.vkeyPath]);

  return artifactPaths;
}

function assertProofArtifacts(): void {
  for (const requiredPath of [artifactPaths.wasmPath, artifactPaths.zkeyPath]) {
    if (!fs.existsSync(requiredPath)) {
      throw new Error(`Missing ${requiredPath}. Run npm run zk:build first.`);
    }
  }
}

export async function generateWitness(
  input: PayrollCircuitInput,
  witnessPath = artifactPaths.witnessPath,
): Promise<string> {
  assertProofArtifacts();
  const circuitInput = await withPayrollCommitment(input);
  await snarkjs.wtns.calculate(circuitInput, artifactPaths.wasmPath, witnessPath);
  return witnessPath;
}

export async function generateProof(
  input: PayrollCircuitInput,
): Promise<GenerateProofResult> {
  assertProofArtifacts();
  const circuitInput = await withPayrollCommitment(input);
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    normalizePayrollCircuitInput(circuitInput),
    artifactPaths.wasmPath,
    artifactPaths.zkeyPath,
  );

  return { proof, publicSignals };
}

export async function verifyProofOffchain(
  proof: Record<string, unknown>,
  publicSignals: string[],
): Promise<boolean> {
  if (!fs.existsSync(artifactPaths.vkeyPath)) {
    throw new Error(`Missing ${artifactPaths.vkeyPath}. Run npm run zk:build first.`);
  }

  const vKey = JSON.parse(fs.readFileSync(artifactPaths.vkeyPath, 'utf8'));
  return snarkjs.groth16.verify(vKey, publicSignals, proof);
}
