import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';
import { readEnv } from '../lib/stellar-env';
import { stellarService, VerificationMode } from './stellar.service';

type Poseidon = ((inputs: bigint[]) => bigint) & { F: { toObject: (value: unknown) => bigint } };
export type ZkFlowStatus =
  | 'COMMITMENT_GENERATED'
  | 'PROOF_GENERATED'
  | 'OFFCHAIN_VERIFIED'
  | 'STELLAR_PENDING'
  | 'STELLAR_VERIFIED'
  | 'STELLAR_FAILED';

export class ZkFlowError extends Error {
  constructor(message: string, public statusCode = 400, public proofStatus?: string) {
    super(message);
  }
}

interface PayrollCommitmentSource {
  operatorPseudoCode: string;
  roleCode: string;
  processedPairs: number;
  ratePerPair: number;
  bonus: number;
  penalty: number;
  expectedPayment: number;
  periodLabel: string;
}

interface CommitmentArtifacts {
  commitmentField: string;
  commitmentHash: string;
  periodHash: string;
  periodHashField: string;
  nonce: string;
  poseidonInputDigest: string;
  hashAlgorithm: 'POSEIDON';
}

const REPO_ROOT = path.resolve(__dirname, '../../../../');

function resolveArtifactPath(configuredPath: string | undefined, fallbackFromRoot: string): string {
  if (!configuredPath) {
    return path.resolve(REPO_ROOT, fallbackFromRoot);
  }

  const normalized = configuredPath.trim().replace(/^['"]|['"]$/g, '');
  if (path.isAbsolute(normalized)) {
    return normalized;
  }

  const cwdPath = path.resolve(process.cwd(), normalized);
  if (fs.existsSync(cwdPath)) {
    return cwdPath;
  }

  return path.resolve(REPO_ROOT, normalized);
}

const WASM_PATH = resolveArtifactPath(
  process.env.ZK_WASM_PATH,
  'packages/zk/build/payroll_js/payroll.wasm',
);

const ZKEY_PATH = resolveArtifactPath(
  process.env.ZK_ZKEY_PATH,
  'packages/zk/build/payroll_final.zkey',
);

const VKEY_PATH = resolveArtifactPath(
  process.env.ZK_VKEY_PATH,
  'packages/zk/build/verification_key.json',
);

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
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid monetary value: ${value}`);
  }
  return BigInt(Math.round(value * 100));
}

function toHex32(value: string | bigint): string {
  const bigint = typeof value === 'bigint' ? value : BigInt(value);
  return `0x${bigint.toString(16).padStart(64, '0').slice(-64)}`;
}

function normalizeStoredField(value: string): string {
  return BigInt(value).toString();
}

function selectRegistryMode(): VerificationMode {
  return readEnv('VERIFICATION_MODE') === 'SIMULATED' ? 'SIMULATED' : 'STELLAR_REGISTRY_TESTNET';
}

function normalizeProofStatus(input: {
  proofStatus?: string | null;
  commitmentHash?: string | null;
  proofJson?: unknown;
  proofData?: string | null;
  publicSignals?: unknown;
  offchainVerified?: boolean | null;
  stellarTxHash?: string | null;
  onchainStatus?: string | null;
  eventConfirmed?: boolean | null;
  stateConfirmed?: boolean | null;
}): ZkFlowStatus | string {
  if (input.onchainStatus === 'STELLAR_VERIFIED' && input.stellarTxHash && (input.eventConfirmed || input.stateConfirmed)) {
    return 'STELLAR_VERIFIED';
  }
  if (input.onchainStatus === 'STELLAR_PENDING') return 'STELLAR_PENDING';
  if (input.onchainStatus === 'STELLAR_FAILED') return 'STELLAR_FAILED';
  if (input.stellarTxHash && (input.eventConfirmed || input.stateConfirmed)) return 'STELLAR_VERIFIED';
  if (input.offchainVerified) return 'OFFCHAIN_VERIFIED';
  if (input.proofStatus === 'OFFCHAIN_VERIFIED') return 'OFFCHAIN_VERIFIED';
  if (input.proofStatus === 'STELLAR_VERIFIED') return 'STELLAR_VERIFIED';
  if (input.proofStatus === 'STELLAR_PENDING') return 'STELLAR_PENDING';
  if (input.proofStatus === 'STELLAR_FAILED') return 'STELLAR_FAILED';
  if (input.proofJson || input.proofData || input.publicSignals || input.proofStatus === 'GENERATED' || input.proofStatus === 'PROOF_GENERATED') {
    return 'PROOF_GENERATED';
  }
  if (input.commitmentHash || input.proofStatus === 'GENERATING' || input.proofStatus === 'COMMITMENT_GENERATED') {
    return 'COMMITMENT_GENERATED';
  }
  return input.proofStatus ?? 'NOT_GENERATED';
}

function summarizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, ' ').slice(0, 500);
}

function buildWitness(input: PayrollCommitmentSource, periodHash: string, nonce: string) {
  return {
    operatorCodeHash: toField(input.operatorPseudoCode),
    roleCode: toField(`role:${input.roleCode}`),
    processedPairs: BigInt(input.processedPairs),
    ratePerPair: cents(input.ratePerPair),
    bonus: cents(input.bonus),
    penalty: cents(input.penalty),
    expectedPayment: cents(input.expectedPayment),
    periodHash: BigInt(periodHash),
    nonce: BigInt(nonce),
  };
}

function toCircuitInput(input: PayrollCommitmentSource, artifacts: CommitmentArtifacts) {
  const witness = buildWitness(input, artifacts.periodHashField, artifacts.nonce);
  return {
    operator_code_hash: witness.operatorCodeHash.toString(),
    role_code: witness.roleCode.toString(),
    processed_pairs: witness.processedPairs.toString(),
    rate_per_pair: witness.ratePerPair.toString(),
    bonus: witness.bonus.toString(),
    penalty: witness.penalty.toString(),
    expected_payment: witness.expectedPayment.toString(),
    period_hash: witness.periodHash.toString(),
    nonce: witness.nonce.toString(),
    commitment: artifacts.commitmentField,
  };
}

async function poseidonHash(values: bigint[]): Promise<string> {
  const poseidon = await getPoseidon();
  return poseidon.F.toObject(poseidon(values)).toString();
}

async function buildCommitmentArtifacts(
  input: PayrollCommitmentSource,
  overrides: { periodHash?: string | null; nonce?: string | null } = {},
): Promise<CommitmentArtifacts> {
  const periodHashField = overrides.periodHash
    ? normalizeStoredField(overrides.periodHash)
    : toField(`period:${input.periodLabel}`).toString();
  const nonce = overrides.nonce ?? BigInt('0x' + crypto.randomBytes(31).toString('hex')).toString();
  const witness = buildWitness(input, periodHashField, nonce);
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
  const commitmentField = await poseidonHash(poseidonInputs);

  return {
    commitmentField,
    commitmentHash: toHex32(commitmentField),
    periodHash: toHex32(periodHashField),
    periodHashField,
    nonce,
    poseidonInputDigest: poseidonInputs.join('|'),
    hashAlgorithm: 'POSEIDON',
  };
}

async function generateCommitmentForInput(
  input: PayrollCommitmentSource,
  overrides: { periodHash?: string | null; nonce?: string | null } = {},
) {
  const commitment = await buildCommitmentArtifacts(input, overrides);
  return {
    commitmentHash: commitment.commitmentHash,
    commitmentField: commitment.commitmentField,
    periodHash: commitment.periodHash,
    periodHashField: commitment.periodHashField,
    nonce: commitment.nonce,
    poseidonInputDigest: commitment.poseidonInputDigest,
    hashAlgorithm: commitment.hashAlgorithm,
    verificationMode: 'STELLAR_REGISTRY_TESTNET',
  };
}

function payrollToCommitmentSource(calc: {
  operator: { pseudonymousCode: string; specialization: string };
  processedPairs: number;
  ratePerPair: number;
  bonus: number;
  penalty: number;
  expectedPayment: number;
  periodLabel: string;
}): PayrollCommitmentSource {
  return {
    operatorPseudoCode: calc.operator.pseudonymousCode,
    roleCode: calc.operator.specialization,
    processedPairs: calc.processedPairs,
    ratePerPair: calc.ratePerPair,
    bonus: calc.bonus,
    penalty: calc.penalty,
    expectedPayment: calc.expectedPayment,
    periodLabel: calc.periodLabel,
  };
}

async function getActiveCircuitVersion() {
  const existing = await prisma.circuitVersion.findFirst({
    where: { name: 'payroll', active: true },
    orderBy: { createdAt: 'desc' },
  });

  if (existing) return existing;

  return prisma.circuitVersion.create({
    data: {
      name: 'payroll',
      version: 'v1-dev',
      provingKeyPath: ZKEY_PATH,
      verifyingKeyPath: VKEY_PATH,
      active: true,
    },
  });
}

async function upsertZkProof(payrollCalculationId: string, data: {
  circuitVersionId?: string;
  commitmentHash: string;
  commitmentField: string;
  periodHash: string;
  proofStatus: string;
}) {
  const existing = await prisma.zkProof.findFirst({
    where: { payrollCalculationId },
    orderBy: { createdAt: 'desc' },
  });

  if (existing) {
    return prisma.zkProof.update({
      where: { id: existing.id },
      data: {
        circuitVersionId: data.circuitVersionId,
        commitmentHash: data.commitmentHash,
        commitmentField: data.commitmentField,
        periodHash: data.periodHash,
        proofStatus: data.proofStatus,
      },
    });
  }

  return prisma.zkProof.create({
    data: {
      payrollCalculationId,
      circuitVersionId: data.circuitVersionId,
      commitmentHash: data.commitmentHash,
      commitmentField: data.commitmentField,
      periodHash: data.periodHash,
      proofStatus: data.proofStatus,
    },
  });
}

async function generateCommitment(payrollCalculationId: string) {
  const calc = await prisma.payrollCalculation.findUnique({
    where: { id: payrollCalculationId },
    include: { operator: true, zkCommitment: true },
  });
  if (!calc) throw new Error('Payroll calculation not found');

  const source = payrollToCommitmentSource(calc);
  const commitment = await buildCommitmentArtifacts(source, {
    periodHash: calc.zkCommitment?.periodHash ?? calc.periodHash,
    nonce: calc.zkCommitment?.nonce,
  });
  const circuitVersion = await getActiveCircuitVersion();

  const [payroll, zkCommitment, zkRecord] = await prisma.$transaction([
    prisma.payrollCalculation.update({
      where: { id: payrollCalculationId },
      data: {
        commitmentHash: commitment.commitmentHash,
        periodHash: commitment.periodHash,
        proofStatus: 'COMMITMENT_GENERATED',
        verificationMode: 'STELLAR_REGISTRY_TESTNET',
      },
    }),
    prisma.zkCommitment.upsert({
      where: { payrollCalculationId },
      update: {
        operatorId: calc.operatorId,
        commitmentHash: commitment.commitmentHash,
        periodHash: commitment.periodHashField,
        poseidonInputDigest: commitment.poseidonInputDigest,
        nonce: commitment.nonce,
        hashAlgorithm: commitment.hashAlgorithm,
        mode: 'STELLAR_REGISTRY_TESTNET',
      },
      create: {
        payrollCalculationId,
        operatorId: calc.operatorId,
        commitmentHash: commitment.commitmentHash,
        periodHash: commitment.periodHashField,
        poseidonInputDigest: commitment.poseidonInputDigest,
        nonce: commitment.nonce,
        hashAlgorithm: commitment.hashAlgorithm,
        mode: 'STELLAR_REGISTRY_TESTNET',
      },
    }),
    prisma.zkVerification.upsert({
      where: { payrollCalculationId },
      update: {
        commitmentHash: commitment.commitmentHash,
        periodHash: commitment.periodHash,
        proofStatus: 'COMMITMENT_GENERATED',
        verificationMode: 'STELLAR_REGISTRY_TESTNET',
      },
      create: {
        payrollCalculationId,
        commitmentHash: commitment.commitmentHash,
        periodHash: commitment.periodHash,
        proofStatus: 'COMMITMENT_GENERATED',
        verificationMode: 'STELLAR_REGISTRY_TESTNET',
      },
    }),
  ]);
  const zkProof = await upsertZkProof(payrollCalculationId, {
    circuitVersionId: circuitVersion.id,
    commitmentHash: commitment.commitmentHash,
    commitmentField: commitment.commitmentField,
    periodHash: commitment.periodHash,
    proofStatus: 'COMMITMENT_GENERATED',
  });

  return { payroll, zkCommitment, zkRecord, zkProof };
}

async function generateProof(payrollCalculationId: string) {
  const calc = await prisma.payrollCalculation.findUnique({
    where: { id: payrollCalculationId },
    include: { operator: true, zkCommitment: true },
  });
  if (!calc) throw new Error('Payroll calculation not found');
  if (!calc.zkCommitment) throw new Error('Commitment must be generated first');
  if (!fs.existsSync(WASM_PATH) || !fs.existsSync(ZKEY_PATH)) {
    throw new Error('ZK artifacts not found. Run npm run zk:build before generating proofs.');
  }

  const source = payrollToCommitmentSource(calc);
  const commitment = await buildCommitmentArtifacts(source, {
    periodHash: calc.zkCommitment.periodHash,
    nonce: calc.zkCommitment.nonce,
  });
  const snarkjs = await getSnarkjs();
  const circuitInput = toCircuitInput(source, commitment);
  const { proof, publicSignals } = await (snarkjs as any).groth16.fullProve(circuitInput, WASM_PATH, ZKEY_PATH);
  const zkProof = await upsertZkProof(payrollCalculationId, {
    commitmentHash: commitment.commitmentHash,
    commitmentField: commitment.commitmentField,
    periodHash: commitment.periodHash,
    proofStatus: 'PROOF_GENERATED',
  });

  const [payroll, zkRecord, updatedProof] = await prisma.$transaction([
    prisma.payrollCalculation.update({
      where: { id: payrollCalculationId },
      data: {
        commitmentHash: commitment.commitmentHash,
        periodHash: commitment.periodHash,
        proofStatus: 'PROOF_GENERATED',
        verificationMode: 'STELLAR_REGISTRY_TESTNET',
      },
    }),
    prisma.zkVerification.upsert({
      where: { payrollCalculationId },
      update: {
        commitmentHash: commitment.commitmentHash,
        periodHash: commitment.periodHash,
        proofStatus: 'PROOF_GENERATED',
        proofData: JSON.stringify(proof),
        publicSignals: JSON.stringify(publicSignals),
        verificationMode: 'STELLAR_REGISTRY_TESTNET',
      },
      create: {
        payrollCalculationId,
        commitmentHash: commitment.commitmentHash,
        periodHash: commitment.periodHash,
        proofStatus: 'PROOF_GENERATED',
        proofData: JSON.stringify(proof),
        publicSignals: JSON.stringify(publicSignals),
        verificationMode: 'STELLAR_REGISTRY_TESTNET',
      },
    }),
    prisma.zkProof.update({
      where: { id: zkProof.id },
      data: {
        proofStatus: 'PROOF_GENERATED',
        proofJson: proof as any,
        publicSignals: publicSignals as any,
        generatedAt: new Date(),
      },
    }),
  ]);

  return { payroll, zkRecord, zkProof: updatedProof, proof, publicSignals };
}

async function verifyProofOffchain(zkProofId: string) {
  const zkProof = await prisma.zkProof.findUnique({ where: { id: zkProofId } });
  if (!zkProof?.proofJson || !zkProof.publicSignals) {
    throw new Error('Generated proof not found');
  }
  if (!fs.existsSync(VKEY_PATH)) {
    throw new Error('Verification key not found. Run npm run zk:build first.');
  }

  const snarkjs = await getSnarkjs();
  const vKey = JSON.parse(fs.readFileSync(VKEY_PATH, 'utf8'));
  const offchainVerified = await (snarkjs as any).groth16.verify(vKey, zkProof.publicSignals, zkProof.proofJson);
  const proofStatus = offchainVerified ? 'OFFCHAIN_VERIFIED' : 'FAILED';
  const verifiedOffchainAt = offchainVerified ? new Date() : null;

  const [updatedProof] = await prisma.$transaction([
    prisma.zkProof.update({
      where: { id: zkProofId },
      data: { proofStatus, verifiedOffchainAt },
    }),
    prisma.zkVerification.updateMany({
      where: { payrollCalculationId: zkProof.payrollCalculationId },
      data: {
        proofStatus,
        verifiedAt: verifiedOffchainAt,
        verificationMode: 'STELLAR_REGISTRY_TESTNET',
      },
    }),
    prisma.payrollCalculation.update({
      where: { id: zkProof.payrollCalculationId },
      data: {
        proofStatus,
        verificationMode: 'STELLAR_REGISTRY_TESTNET',
        verifiedAt: verifiedOffchainAt,
      },
    }),
  ]);

  return { zkProof: updatedProof, offchainVerified };
}

async function submitProofToStellar(zkProofId: string) {
  const zkProof = await prisma.zkProof.findUnique({
    where: { id: zkProofId },
    include: { payrollCalculation: { include: { zkCommitment: true, zkRecord: true } }, onchainVerification: true },
  });
  if (!zkProof) throw new Error('ZK proof not found');

  const currentStatus = normalizeProofStatus({
    proofStatus: zkProof.proofStatus,
    commitmentHash: zkProof.commitmentHash,
    proofJson: zkProof.proofJson,
    publicSignals: zkProof.publicSignals,
    offchainVerified: Boolean(zkProof.verifiedOffchainAt),
    stellarTxHash: zkProof.onchainVerification?.stellarTxHash ?? zkProof.payrollCalculation.stellarTxHash,
    onchainStatus: zkProof.onchainVerification?.status,
    eventConfirmed: zkProof.onchainVerification?.eventConfirmed,
    stateConfirmed: zkProof.onchainVerification?.status === 'STELLAR_VERIFIED',
  });

  if (currentStatus !== 'OFFCHAIN_VERIFIED') {
    throw new ZkFlowError(
      'Run generate-proof and verify-offchain before verify-on-stellar.',
      400,
      currentStatus,
    );
  }

  const verificationMode = selectRegistryMode();
  if (verificationMode === 'SIMULATED') {
    throw new ZkFlowError(
      'VERIFICATION_MODE is SIMULATED. No real Stellar transaction will be submitted.',
      400,
      currentStatus,
    );
  }
  const pendingAt = new Date();

  await prisma.$transaction([
    prisma.onchainVerification.upsert({
      where: { zkProofId },
      update: {
        verificationMode,
        status: 'STELLAR_PENDING',
        contractId: null,
        stellarTxHash: null,
        commitmentHash: zkProof.commitmentHash,
        periodHash: zkProof.periodHash,
        ledger: null,
        eventConfirmed: false,
        submittedAt: pendingAt,
        verifiedAt: null,
      },
      create: {
        zkProofId,
        verificationMode,
        status: 'STELLAR_PENDING',
        contractId: null,
        stellarTxHash: null,
        commitmentHash: zkProof.commitmentHash,
        periodHash: zkProof.periodHash,
        ledger: null,
        eventConfirmed: false,
        submittedAt: pendingAt,
        verifiedAt: null,
      },
    }),
    prisma.payrollCalculation.update({
      where: { id: zkProof.payrollCalculationId },
      data: {
        proofStatus: 'STELLAR_PENDING',
        verificationStatus: 'Submitting registry transaction to Stellar Testnet.',
        verificationMode,
      },
    }),
    prisma.zkVerification.updateMany({
      where: { payrollCalculationId: zkProof.payrollCalculationId },
      data: {
        proofStatus: 'STELLAR_PENDING',
        verificationMode,
      },
    }),
  ]);

  const stellarResult = await stellarService.submitPayrollRegistryVerification({
    commitmentHash: zkProof.commitmentHash,
    periodHash: zkProof.periodHash,
    verificationMode,
  });
  const confirmed = Boolean(stellarResult.success && (stellarResult.eventConfirmed || stellarResult.stateConfirmed));
  const finalStatus: ZkFlowStatus = confirmed ? 'STELLAR_VERIFIED' : 'STELLAR_FAILED';
  const verifiedAt = confirmed ? new Date() : null;
  const errorMessage = confirmed
    ? null
    : summarizeError(stellarResult.error ?? 'Stellar transaction was not confirmed by event or contract state.');

  const [onchainVerification] = await prisma.$transaction([
    prisma.onchainVerification.upsert({
      where: { zkProofId },
      update: {
        verificationMode: stellarResult.verificationMode,
        status: finalStatus,
        contractId: stellarResult.contractId,
        stellarTxHash: stellarResult.txHash || null,
        commitmentHash: zkProof.commitmentHash,
        periodHash: zkProof.periodHash,
        ledger: stellarResult.ledger || null,
        eventConfirmed: stellarResult.eventConfirmed ?? false,
        submittedAt: pendingAt,
        verifiedAt,
      },
      create: {
        zkProofId,
        verificationMode: stellarResult.verificationMode,
        status: finalStatus,
        contractId: stellarResult.contractId,
        stellarTxHash: stellarResult.txHash || null,
        commitmentHash: zkProof.commitmentHash,
        periodHash: zkProof.periodHash,
        ledger: stellarResult.ledger || null,
        eventConfirmed: stellarResult.eventConfirmed ?? false,
        submittedAt: pendingAt,
        verifiedAt,
      },
    }),
    prisma.zkProof.update({
      where: { id: zkProofId },
      data: { proofStatus: finalStatus },
    }),
    prisma.payrollCalculation.update({
      where: { id: zkProof.payrollCalculationId },
      data: {
        proofStatus: finalStatus,
        verificationStatus: errorMessage ?? stellarResult.status,
        verificationMode: stellarResult.verificationMode,
        stellarTxHash: stellarResult.txHash || null,
        stellarContractId: stellarResult.contractId,
        verifiedAt,
      },
    }),
    prisma.zkVerification.updateMany({
      where: { payrollCalculationId: zkProof.payrollCalculationId },
      data: {
        proofStatus: finalStatus,
        verificationMode: stellarResult.verificationMode,
        stellarTxHash: stellarResult.txHash || null,
        stellarContractId: stellarResult.contractId,
        verifiedAt,
      },
    }),
    ...(confirmed && zkProof.payrollCalculation.zkCommitment && stellarResult.txHash
      ? [
          prisma.stellarSubmission.create({
            data: {
              zkCommitmentId: zkProof.payrollCalculation.zkCommitment.id,
              payrollCalculationId: zkProof.payrollCalculationId,
              txHash: stellarResult.txHash,
              contractId: stellarResult.contractId,
              status: finalStatus,
              mode: stellarResult.verificationMode,
              ledger: stellarResult.ledger,
            },
          }),
        ]
      : []),
  ]);

  if (!confirmed) {
    throw new ZkFlowError(
      errorMessage ?? 'Stellar registry submission failed.',
      stellarResult.success ? 502 : 500,
      finalStatus,
    );
  }

  return { onchainVerification, stellar: stellarResult };
}

export const zkService = {
  normalizeProofStatus,
  generateCommitmentForInput,
  generateCommitment,
  generateProof,
  verifyProofOffchain,
  submitProofToStellar,
};
