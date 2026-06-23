import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

type Poseidon = ((inputs: bigint[]) => bigint) & { F: { toObject: (value: unknown) => bigint } };

export interface CommitmentInput {
  operatorPseudoCode: string;
  roleCode: string;
  processedPairs: number;
  ratePerPair: number;
  bonus: number;
  penalty: number;
  expectedPayment: number;
  periodLabel: string;
}

export interface CommitmentOutput {
  commitmentHash: string;
  periodHash: string;
  nonce: string;
  poseidonInputDigest: string;
  hashAlgorithm: 'POSEIDON';
  verificationMode: string;
}

export interface ProofInput extends CommitmentInput {
  commitmentHash: string;
  periodHash: string;
  nonce: string;
  verificationMode: string;
}

export interface ProofOutput {
  success: boolean;
  proof: Record<string, unknown>;
  publicSignals: string[];
  verificationMode: string;
  isSimulated: boolean;
}

const WASM_PATH = process.env.ZK_WASM_PATH
  ? path.resolve(process.cwd(), process.env.ZK_WASM_PATH)
  : path.resolve(__dirname, '../../../../packages/zk/build/payroll_js/payroll.wasm');

const ZKEY_PATH = process.env.ZK_ZKEY_PATH
  ? path.resolve(process.cwd(), process.env.ZK_ZKEY_PATH)
  : path.resolve(__dirname, '../../../../packages/zk/build/payroll_final.zkey');

const VKEY_PATH = process.env.ZK_VKEY_PATH
  ? path.resolve(process.cwd(), process.env.ZK_VKEY_PATH)
  : path.resolve(__dirname, '../../../../packages/zk/build/verification_key.json');

let poseidonPromise: Promise<Poseidon> | null = null;
let snarkjsPromise: Promise<typeof import('snarkjs')> | null = null;

async function getPoseidon(): Promise<Poseidon> {
  if (!poseidonPromise) {
    poseidonPromise = import('circomlibjs').then(async mod => {
      const poseidon = await (mod as { buildPoseidon: () => Promise<Poseidon> }).buildPoseidon();
      return poseidon;
    });
  }
  return poseidonPromise;
}

async function getSnarkjs(): Promise<typeof import('snarkjs')> {
  if (!snarkjsPromise) {
    snarkjsPromise = import('snarkjs') as Promise<typeof import('snarkjs')>;
  }
  return snarkjsPromise;
}

function toField(value: string): bigint {
  const hex = crypto.createHash('sha256').update(value).digest('hex').substring(0, 62);
  return BigInt('0x' + hex);
}

function cents(value: number): bigint {
  return BigInt(Math.round(value * 100));
}

function buildWitness(input: CommitmentInput, periodHash: string, nonce: string) {
  const processedPairs = BigInt(input.processedPairs);
  const ratePerPair = cents(input.ratePerPair);
  const bonus = cents(input.bonus);
  const penalty = cents(input.penalty);
  const expectedPayment = cents(input.expectedPayment);

  return {
    operatorCodeHash: toField(input.operatorPseudoCode),
    roleCode: toField(`role:${input.roleCode}`),
    processedPairs,
    ratePerPair,
    bonus,
    penalty,
    expectedPayment,
    periodHash: BigInt(periodHash),
    nonce: BigInt(nonce),
  };
}

async function poseidonHash(values: bigint[]): Promise<string> {
  const poseidon = await getPoseidon();
  return poseidon.F.toObject(poseidon(values)).toString();
}

async function generateCommitment(
  input: CommitmentInput,
  overrides: { periodHash?: string; nonce?: string } = {},
): Promise<CommitmentOutput> {
  const periodHash = overrides.periodHash ?? toField(`period:${input.periodLabel}`).toString();
  const nonce = overrides.nonce ?? BigInt('0x' + crypto.randomBytes(31).toString('hex')).toString();
  const witness = buildWitness(input, periodHash, nonce);
  const poseidonInputs = [
    witness.operatorCodeHash,
    witness.roleCode,
    witness.processedPairs,
    witness.ratePerPair,
    witness.bonus,
    witness.penalty,
    witness.expectedPayment,
    witness.periodHash,
    witness.nonce,
  ];
  const commitmentHash = await poseidonHash(poseidonInputs);

  return {
    commitmentHash,
    periodHash,
    nonce,
    poseidonInputDigest: poseidonInputs.join('|'),
    hashAlgorithm: 'POSEIDON',
    verificationMode: 'ZK_OFFCHAIN',
  };
}

async function generateProof(input: ProofInput): Promise<ProofOutput> {
  if (!fs.existsSync(WASM_PATH) || !fs.existsSync(ZKEY_PATH)) {
    throw new Error(`ZK artifacts not found. Run packages/zk/scripts/build.sh before generating real proofs.`);
  }

  const snarkjs = await getSnarkjs();
  const witness = buildWitness(input, input.periodHash, input.nonce);
  const circuitInput = {
    operator_code_hash: witness.operatorCodeHash.toString(),
    role_code: witness.roleCode.toString(),
    processed_pairs: witness.processedPairs.toString(),
    rate_per_pair: witness.ratePerPair.toString(),
    bonus: witness.bonus.toString(),
    penalty: witness.penalty.toString(),
    expected_payment: witness.expectedPayment.toString(),
    period_hash: witness.periodHash.toString(),
    nonce: witness.nonce.toString(),
    commitment: input.commitmentHash,
  };

  const { proof, publicSignals } = await (snarkjs as any).groth16.fullProve(
    circuitInput,
    WASM_PATH,
    ZKEY_PATH,
  );

  return {
    success: true,
    proof,
    publicSignals,
    verificationMode: 'ZK_OFFCHAIN',
    isSimulated: false,
  };
}

async function verifyProofLocally(
  proof: Record<string, unknown>,
  publicSignals: string[],
): Promise<boolean> {
  if (!fs.existsSync(VKEY_PATH)) {
    throw new Error(`Verification key not found. Run packages/zk/scripts/build.sh first.`);
  }
  const snarkjs = await getSnarkjs();
  const vKey = JSON.parse(fs.readFileSync(VKEY_PATH, 'utf8'));
  return (snarkjs as any).groth16.verify(vKey, publicSignals, proof);
}

export const zkService = {
  generateCommitment,
  generateProof,
  verifyProofLocally,
};
