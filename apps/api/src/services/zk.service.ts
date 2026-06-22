import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

type Poseidon = ((inputs: bigint[]) => bigint) & { F: { toObject: (value: unknown) => bigint } };

export interface CommitmentInput {
  operatorPseudoCode: string;
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
  const units = BigInt(input.processedPairs);
  const rate = cents(input.ratePerPair);
  const bonus = cents(input.bonus);
  const payment = units * rate + bonus;

  return {
    operatorCodeHash: toField(input.operatorPseudoCode),
    units,
    rate,
    bonus,
    payment,
    periodHash: BigInt(periodHash),
    nonce: BigInt(nonce),
  };
}

async function poseidonHash(values: bigint[]): Promise<string> {
  const poseidon = await getPoseidon();
  return poseidon.F.toObject(poseidon(values)).toString();
}

async function generateCommitment(input: CommitmentInput): Promise<CommitmentOutput> {
  const periodHash = toField(`period:${input.periodLabel}`).toString();
  const nonce = BigInt('0x' + crypto.randomBytes(31).toString('hex')).toString();
  const witness = buildWitness(input, periodHash, nonce);
  const poseidonInputs = [
    witness.operatorCodeHash,
    witness.units,
    witness.rate,
    witness.bonus,
    witness.payment,
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
    verificationMode: input.penalty === 0 ? 'ZK_OFFCHAIN' : 'ZK_OFFCHAIN',
  };
}

async function generateProof(input: ProofInput): Promise<ProofOutput> {
  if (!fs.existsSync(WASM_PATH) || !fs.existsSync(ZKEY_PATH)) {
    throw new Error(`ZK artifacts not found. Run packages/zk/scripts/build.sh before generating real proofs.`);
  }

  const snarkjs = await getSnarkjs();
  const witness = buildWitness(input, input.periodHash, input.nonce);
  const circuitInput = {
    operatorCodeHash: witness.operatorCodeHash.toString(),
    units: witness.units.toString(),
    rate: witness.rate.toString(),
    bonus: witness.bonus.toString(),
    payment: witness.payment.toString(),
    periodHash: witness.periodHash.toString(),
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
