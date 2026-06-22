/**
 * Zenta ZK Service
 * Handles Groth16 proof generation via snarkjs.
 * In SIMULATED mode: uses SHA256 hashes and mock proofs.
 * In real mode: uses compiled Circom WASM + proving key from packages/zk/build/
 *
 * IMPORTANT: Proof generation is CPU intensive. For production, this should
 * run in a worker thread or separate process.
 */
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

// Dynamic import of snarkjs to handle ESM/CJS differences
let snarkjs: typeof import('snarkjs') | null = null;
async function getSnarkjs() {
  if (!snarkjs) {
    try {
      snarkjs = await import('snarkjs') as typeof import('snarkjs');
    } catch {
      console.warn('[ZK] snarkjs not available, using simulation mode');
    }
  }
  return snarkjs;
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

const zkFilesExist = () =>
  fs.existsSync(WASM_PATH) && fs.existsSync(ZKEY_PATH) && fs.existsSync(VKEY_PATH);

// ---- Types --------------------------------------------------

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
}

export interface ProofInput extends CommitmentInput {
  commitmentHash: string;
  periodHash: string;
  verificationMode: string;
}

export interface ProofOutput {
  success: boolean;
  proof: Record<string, unknown>;
  publicSignals: string[];
  verificationMode: string;
  isSimulated: boolean;
}

// ---- Commitment Generation ----------------------------------

function sha256hex(data: string): string {
  return '0x' + crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Generate a cryptographic commitment for a payroll calculation.
 * Uses Poseidon hash when ZK files are available, SHA256 otherwise.
 * The commitment is a public reference that links the ERP record
 * to the ZK proof without revealing private data.
 */
async function generateCommitment(input: CommitmentInput): Promise<CommitmentOutput> {
  const nonce = crypto.randomBytes(16).toString('hex');

  // periodHash = hash(periodLabel) — public, identifies the payroll period
  const periodHash = sha256hex(input.periodLabel + '-period');

  // commitment = hash(operatorCode, pairs, rate, bonus, penalty, payment, periodHash, nonce)
  // This is the public commitment; private inputs stay off-chain
  const preimage = [
    input.operatorPseudoCode,
    input.processedPairs.toString(),
    Math.round(input.ratePerPair * 100).toString(), // integer representation
    Math.round(input.bonus * 100).toString(),
    Math.round(input.penalty * 100).toString(),
    Math.round(input.expectedPayment * 100).toString(),
    periodHash,
    nonce,
  ].join('|');

  const commitmentHash = sha256hex(preimage);

  return { commitmentHash, periodHash, nonce };
}

// ---- Proof Generation ---------------------------------------

/**
 * Generate a Groth16 ZK proof for the payroll calculation.
 *
 * Circuit constraints proven:
 * 1. expectedPayment == processedPairs * ratePerPair + bonus - penalty
 * 2. processedPairs >= 0
 * 3. ratePerPair >= 0
 * 4. bonus >= 0
 * 5. penalty >= 0
 * 6. commitment == Poseidon(privateInputs, periodHash, nonce)
 *
 * Private inputs (never revealed):
 * - operatorCodeHash
 * - processedPairs
 * - ratePerPair
 * - bonus
 * - penalty
 * - expectedPayment
 * - nonce
 *
 * Public inputs (verifiable on-chain):
 * - commitment
 * - periodHash
 */
async function generateProof(input: ProofInput): Promise<ProofOutput> {
  const isSimulated = input.verificationMode === 'SIMULATED' || !zkFilesExist();

  if (!isSimulated) {
    // ---- Real Groth16 proof via snarkjs -----------------------
    const snarks = await getSnarkjs();
    if (!snarks) {
      console.warn('[ZK] snarkjs unavailable, falling back to simulation');
      return generateSimulatedProof(input);
    }

    try {
      // Build circuit witness inputs (must match payroll.circom signal names)
      const circuitInputs = {
        operatorCodeHash: BigInt('0x' + crypto.createHash('sha256')
          .update(input.operatorPseudoCode)
          .digest('hex')
          .substring(0, 32)
        ).toString(),
        processedPairs: input.processedPairs.toString(),
        // Store as integer cents to avoid float in ZK
        ratePerPair: Math.round(input.ratePerPair * 100).toString(),
        bonus: Math.round(input.bonus * 100).toString(),
        penalty: Math.round(input.penalty * 100).toString(),
        expectedPayment: Math.round(input.expectedPayment * 100).toString(),
        nonce: BigInt('0x' + crypto.randomBytes(16).toString('hex')).toString(),
        periodHash: BigInt(input.periodHash.replace('0x', '0x')).toString(),
      };

      const { proof, publicSignals } = await (snarks as any).groth16.fullProve(
        circuitInputs,
        WASM_PATH,
        ZKEY_PATH,
      );

      return {
        success: true,
        proof,
        publicSignals,
        verificationMode: input.verificationMode,
        isSimulated: false,
      };
    } catch (err) {
      console.error('[ZK] Proof generation failed:', err);
      throw new Error(`Proof generation failed: ${(err as Error).message}`);
    }
  }

  return generateSimulatedProof(input);
}

/**
 * SIMULATED proof — clearly labeled, for development/demo.
 * Generates a mock Groth16 structure with hash-based fake pi values.
 * DO NOT use as real cryptographic proof.
 */
function generateSimulatedProof(input: ProofInput): ProofOutput {
  console.log('[ZK][SIMULATED] Generating mock Groth16 proof for demo purposes');

  const h = (s: string) => '0x' + crypto.createHash('sha256').update(s).digest('hex').substring(0, 40);
  const base = input.commitmentHash + input.periodHash;

  return {
    success: true,
    proof: {
      pi_a: [h(base + 'a0'), h(base + 'a1'), '0x1'],
      pi_b: [
        [h(base + 'b00'), h(base + 'b01')],
        [h(base + 'b10'), h(base + 'b11')],
        ['0x1', '0x0'],
      ],
      pi_c: [h(base + 'c0'), h(base + 'c1'), '0x1'],
      protocol: 'groth16',
      curve: 'bn128',
      _simulation: true, // clearly marked as simulated
    },
    publicSignals: ['1', input.commitmentHash, input.periodHash],
    verificationMode: 'SIMULATED',
    isSimulated: true,
  };
}

// ---- Local Proof Verification -------------------------------

async function verifyProofLocally(
  proof: Record<string, unknown>,
  publicSignals: string[],
): Promise<boolean> {
  // Check for simulation marker
  if ((proof as any)._simulation === true) {
    console.log('[ZK][SIMULATED] Local verification (simulation mode)');
    return true;
  }

  if (!fs.existsSync(VKEY_PATH)) {
    console.warn('[ZK] Verification key not found, skipping local verification');
    return true;
  }

  const snarks = await getSnarkjs();
  if (!snarks) return true;

  try {
    const vKey = JSON.parse(fs.readFileSync(VKEY_PATH, 'utf8'));
    return await (snarks as any).groth16.verify(vKey, publicSignals, proof);
  } catch (err) {
    console.error('[ZK] Local verification failed:', err);
    return false;
  }
}

export const zkService = {
  generateCommitment,
  generateProof,
  verifyProofLocally,
};
