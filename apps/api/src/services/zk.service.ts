import crypto from 'crypto';

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
  hashAlgorithm: 'POSEIDON_SIMULATED';
  verificationMode: 'SIMULATED';
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
  verificationMode: 'SIMULATED';
  isSimulated: true;
}

function sha256hex(data: string): string {
  return '0x' + crypto.createHash('sha256').update(data).digest('hex');
}

function toField(value: string): string {
  const hex = crypto.createHash('sha256').update(value).digest('hex').substring(0, 62);
  return BigInt('0x' + hex).toString();
}

async function generateCommitment(input: CommitmentInput): Promise<CommitmentOutput> {
  const nonce = crypto.randomBytes(16).toString('hex');
  const periodHash = sha256hex(`period:${input.periodLabel}`);
  const poseidonInputs = [
    toField(input.operatorPseudoCode),
    input.processedPairs.toString(),
    Math.round(input.ratePerPair * 100).toString(),
    Math.round(input.bonus * 100).toString(),
    Math.round(input.penalty * 100).toString(),
    Math.round(input.expectedPayment * 100).toString(),
    BigInt(periodHash).toString(),
    BigInt('0x' + nonce).toString(),
  ];

  const poseidonInputDigest = sha256hex(poseidonInputs.join('|'));
  const commitmentHash = sha256hex(`POSEIDON_SIMULATED:${poseidonInputDigest}`);

  return {
    commitmentHash,
    periodHash,
    nonce,
    poseidonInputDigest,
    hashAlgorithm: 'POSEIDON_SIMULATED',
    verificationMode: 'SIMULATED',
  };
}

async function generateProof(input: ProofInput): Promise<ProofOutput> {
  console.log('[ZK][SIMULATED] Generating mock proof envelope');

  const hashPart = (label: string) =>
    '0x' + crypto.createHash('sha256').update(`${input.commitmentHash}:${input.periodHash}:${label}`).digest('hex').substring(0, 40);

  return {
    success: true,
    proof: {
      pi_a: [hashPart('a0'), hashPart('a1'), '0x1'],
      pi_b: [
        [hashPart('b00'), hashPart('b01')],
        [hashPart('b10'), hashPart('b11')],
        ['0x1', '0x0'],
      ],
      pi_c: [hashPart('c0'), hashPart('c1'), '0x1'],
      protocol: 'groth16',
      curve: 'bn128',
      commitmentScheme: 'POSEIDON_SIMULATED',
      _simulation: true,
    },
    publicSignals: [input.commitmentHash, input.periodHash, 'SIMULATED_OK'],
    verificationMode: 'SIMULATED',
    isSimulated: true,
  };
}

async function verifyProofLocally(
  proof: Record<string, unknown>,
  _publicSignals: string[],
): Promise<boolean> {
  return (proof as { _simulation?: boolean })._simulation === true;
}

export const zkService = {
  generateCommitment,
  generateProof,
  verifyProofLocally,
};
