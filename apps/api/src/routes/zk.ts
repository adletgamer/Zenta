import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { createAuditEvent } from '../lib/audit';
import { zkService } from '../services/zk.service';

export const zkRouter = Router();

const payrollBody = z.object({ payrollCalculationId: z.string() });
const proofBody = z.object({
  zkProofId: z.string().optional(),
  payrollCalculationId: z.string().optional(),
});

async function resolveZkProofId(body: z.infer<typeof proofBody>): Promise<string> {
  if (body.zkProofId) return body.zkProofId;
  if (!body.payrollCalculationId) {
    throw new Error('zkProofId or payrollCalculationId is required');
  }

  const latest = await prisma.zkProof.findFirst({
    where: { payrollCalculationId: body.payrollCalculationId },
    orderBy: { createdAt: 'desc' },
  });
  if (!latest) throw new Error('ZK proof not found for payrollCalculationId');
  return latest.id;
}

zkRouter.get('/summary', async (_req, res) => {
  const [payrolls, proofs, verifications] = await Promise.all([
    prisma.payrollCalculation.findMany(),
    prisma.zkProof.findMany({ orderBy: { createdAt: 'desc' }, take: 1 }),
    prisma.onchainVerification.findMany({ orderBy: { createdAt: 'desc' }, take: 1 }),
  ]);

  res.json({
    success: true,
    data: {
      pendingPayrolls: payrolls.filter(p => p.pendingBalance > 0).length,
      generatedProofs: payrolls.filter(p => ['GENERATED', 'OFFCHAIN_VERIFIED', 'VERIFIED'].includes(p.proofStatus)).length,
      verifiedOnchain: payrolls.filter(p => p.proofStatus === 'VERIFIED').length,
      latestCommitmentHash: proofs[0]?.commitmentHash ?? null,
      mode: verifications[0]?.verificationMode ?? process.env.VERIFICATION_MODE ?? 'SIMULATED',
    },
  });
});

zkRouter.get('/queue', async (_req, res) => {
  const payrolls = await prisma.payrollCalculation.findMany({
    include: { operator: true, zkRecord: true, zkCommitment: true, zkProofs: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: payrolls });
});

zkRouter.get('/verifications', async (_req, res) => {
  const proofs = await prisma.zkProof.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      circuitVersion: true,
      onchainVerification: true,
      payrollCalculation: { include: { operator: true, zkCommitment: true } },
    },
  });

  const verifications = proofs.map(proof => ({
    id: proof.id,
    zkProofId: proof.id,
    payrollCalculationId: proof.payrollCalculationId,
    commitmentHash: proof.commitmentHash,
    commitmentField: proof.commitmentField,
    periodHash: proof.periodHash,
    proofStatus: proof.onchainVerification?.status === 'STELLAR_VERIFIED'
      ? 'VERIFIED'
      : proof.proofStatus,
    proofData: proof.proofJson ? JSON.stringify(proof.proofJson) : null,
    publicSignals: proof.publicSignals ? JSON.stringify(proof.publicSignals) : null,
    verificationMode: proof.onchainVerification?.verificationMode
      ?? proof.payrollCalculation.verificationMode,
    stellarTxHash: proof.onchainVerification?.stellarTxHash
      ?? proof.payrollCalculation.stellarTxHash,
    stellarContractId: proof.onchainVerification?.contractId
      ?? proof.payrollCalculation.stellarContractId,
    ledger: proof.onchainVerification?.ledger ?? null,
    eventConfirmed: proof.onchainVerification?.eventConfirmed ?? false,
    stateConfirmed: proof.onchainVerification?.status === 'STELLAR_VERIFIED'
      ? true
      : false,
    confirmationSource: proof.onchainVerification?.eventConfirmed
      ? 'event'
      : proof.onchainVerification?.status === 'STELLAR_VERIFIED' ? 'contract_state' : 'none',
    verifiedAt: proof.onchainVerification?.verifiedAt
      ?? proof.verifiedOffchainAt
      ?? proof.payrollCalculation.verifiedAt,
    generatedAt: proof.generatedAt,
    verifiedOffchainAt: proof.verifiedOffchainAt,
    circuitVersion: proof.circuitVersion,
    payrollCalculation: proof.payrollCalculation,
    proofSystem: 'Groth16',
    circuit: 'Circom payroll.circom',
    commitmentScheme: 'Poseidon',
  }));

  res.json({ success: true, data: verifications });
});

zkRouter.get('/verifications/:id', async (req, res) => {
  const verification = await prisma.onchainVerification.findUnique({
    where: { id: req.params.id },
    include: { zkProof: { include: { payrollCalculation: { include: { operator: true } } } } },
  });
  if (!verification) return res.status(404).json({ success: false, error: 'Verification not found' });
  res.json({ success: true, data: verification });
});

zkRouter.get('/proofs/:id', async (req, res) => {
  const proof = await prisma.zkProof.findUnique({
    where: { id: req.params.id },
    include: {
      circuitVersion: true,
      onchainVerification: true,
      payrollCalculation: { include: { operator: true } },
    },
  });
  if (!proof) return res.status(404).json({ success: false, error: 'Proof not found' });
  res.json({ success: true, data: proof });
});

zkRouter.post('/generate-commitment', async (req, res) => {
  const { payrollCalculationId } = payrollBody.parse(req.body);
  const result = await zkService.generateCommitment(payrollCalculationId);

  await createAuditEvent({
    eventType: 'COMMITMENT_GENERATED',
    entityType: 'ZkProof',
    entityId: result.zkProof.id,
    operatorId: result.payroll.operatorId,
    commitmentHash: result.zkProof.commitmentHash,
    metadata: {
      verificationMode: result.payroll.verificationMode,
      proofStatus: result.zkProof.proofStatus,
    },
  });

  res.json({
    zkProofId: result.zkProof.id,
    payrollCalculationId,
    commitmentHash: result.zkProof.commitmentHash,
    commitmentField: result.zkProof.commitmentField,
    periodHash: result.zkProof.periodHash,
    proofStatus: result.zkProof.proofStatus,
  });
});

zkRouter.post('/generate-proof', async (req, res) => {
  const { payrollCalculationId } = payrollBody.parse(req.body);
  const result = await zkService.generateProof(payrollCalculationId);

  await createAuditEvent({
    eventType: 'PROOF_GENERATED',
    entityType: 'ZkProof',
    entityId: result.zkProof.id,
    operatorId: result.payroll.operatorId,
    commitmentHash: result.zkProof.commitmentHash,
    metadata: {
      proofStatus: result.zkProof.proofStatus,
      publicSignals: result.publicSignals,
    },
  });

  res.json({
    zkProofId: result.zkProof.id,
    payrollCalculationId,
    proofStatus: result.zkProof.proofStatus,
    publicSignals: result.publicSignals,
    commitmentHash: result.zkProof.commitmentHash,
  });
});

zkRouter.post('/verify-offchain', async (req, res) => {
  const zkProofId = await resolveZkProofId(proofBody.parse(req.body));
  const result = await zkService.verifyProofOffchain(zkProofId);

  res.json({
    zkProofId,
    proofStatus: result.zkProof.proofStatus,
    offchainVerified: result.offchainVerified,
  });
});

zkRouter.post('/verify-on-stellar', async (req, res) => {
  const zkProofId = await resolveZkProofId(proofBody.parse(req.body));
  const result = await zkService.submitProofToStellar(zkProofId);

  res.json({
    zkProofId,
    verificationMode: result.onchainVerification.verificationMode,
    status: result.onchainVerification.status,
    stellarTxHash: result.onchainVerification.stellarTxHash,
    ledger: result.onchainVerification.ledger,
    eventConfirmed: result.stellar.eventConfirmed ?? result.onchainVerification.eventConfirmed,
    stateConfirmed: result.stellar.stateConfirmed ?? false,
    confirmationSource: result.stellar.confirmationSource ?? 'none',
    commitmentHash: result.stellar.commitmentHash ?? result.onchainVerification.commitmentHash,
    periodHash: result.stellar.periodHash ?? result.onchainVerification.periodHash,
    contractId: result.onchainVerification.contractId,
  });
});
