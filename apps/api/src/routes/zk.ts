import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { createAuditEvent } from '../lib/audit';
import { zkService } from '../services/zk.service';
import { stellarService } from '../services/stellar.service';

export const zkRouter = Router();
const verificationMode = 'ZK_OFFCHAIN';

zkRouter.get('/summary', async (_req, res) => {
  const [payrolls, verifications] = await Promise.all([
    prisma.payrollCalculation.findMany(),
    prisma.zkVerification.findMany({ orderBy: { createdAt: 'desc' }, take: 1 }),
  ]);

  const pendingPayrolls = payrolls.filter(p => p.pendingBalance > 0).length;
  const generatedProofs = payrolls.filter(p => ['GENERATED', 'VERIFYING', 'VERIFIED'].includes(p.proofStatus)).length;
  const verifiedOnchain = payrolls.filter(p => p.proofStatus === 'VERIFIED').length;

  res.json({
    success: true,
    data: {
      pendingPayrolls,
      generatedProofs,
      verifiedOnchain,
      latestCommitmentHash: verifications[0]?.commitmentHash || null,
      mode: verificationMode,
    },
  });
});

zkRouter.get('/queue', async (_req, res) => {
  const payrolls = await prisma.payrollCalculation.findMany({
    include: { operator: true, zkRecord: true, zkCommitment: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: payrolls });
});

zkRouter.get('/verifications', async (_req, res) => {
  const verifications = await prisma.zkVerification.findMany({
    orderBy: { createdAt: 'desc' },
    include: { payrollCalculation: { include: { operator: true, zkCommitment: true } } },
  });
  res.json({ success: true, data: verifications });
});

zkRouter.get('/verifications/:id', async (req, res) => {
  const verification = await prisma.zkVerification.findUnique({
    where: { id: req.params.id },
    include: { payrollCalculation: { include: { operator: true, zkCommitment: true } } },
  });
  if (!verification) return res.status(404).json({ success: false, error: 'Verification not found' });
  res.json({ success: true, data: verification });
});

zkRouter.post('/generate-commitment', async (req, res) => {
  const { payrollCalculationId } = z.object({ payrollCalculationId: z.string() }).parse(req.body);
  const calc = await prisma.payrollCalculation.findUnique({
    where: { id: payrollCalculationId },
    include: { operator: true },
  });
  if (!calc) return res.status(404).json({ success: false, error: 'Payroll calculation not found' });

  const commitment = await zkService.generateCommitment({
    operatorPseudoCode: calc.operator.pseudonymousCode,
    processedPairs: calc.processedPairs,
    ratePerPair: calc.ratePerPair,
    bonus: calc.bonus,
    penalty: calc.penalty,
    expectedPayment: calc.expectedPayment,
    periodLabel: calc.periodLabel,
  });

  const [updatedPayroll, zkCommitment, zkRecord] = await prisma.$transaction([
    prisma.payrollCalculation.update({
      where: { id: payrollCalculationId },
      data: {
        commitmentHash: commitment.commitmentHash,
        periodHash: commitment.periodHash,
        proofStatus: 'GENERATING',
        verificationMode,
      },
    }),
    prisma.zkCommitment.upsert({
      where: { payrollCalculationId },
      update: {
        operatorId: calc.operatorId,
        commitmentHash: commitment.commitmentHash,
        periodHash: commitment.periodHash,
        poseidonInputDigest: commitment.poseidonInputDigest,
        nonce: commitment.nonce,
        hashAlgorithm: commitment.hashAlgorithm,
        mode: verificationMode,
      },
      create: {
        payrollCalculationId,
        operatorId: calc.operatorId,
        commitmentHash: commitment.commitmentHash,
        periodHash: commitment.periodHash,
        poseidonInputDigest: commitment.poseidonInputDigest,
        nonce: commitment.nonce,
        hashAlgorithm: commitment.hashAlgorithm,
        mode: verificationMode,
      },
    }),
    prisma.zkVerification.upsert({
      where: { payrollCalculationId },
      update: {
        commitmentHash: commitment.commitmentHash,
        periodHash: commitment.periodHash,
        proofStatus: 'GENERATING',
        verificationMode,
      },
      create: {
        payrollCalculationId,
        commitmentHash: commitment.commitmentHash,
        periodHash: commitment.periodHash,
        proofStatus: 'GENERATING',
        verificationMode,
      },
    }),
  ]);

  await createAuditEvent({
    eventType: 'COMMITMENT_GENERATED',
    entityType: 'ZkCommitment',
    entityId: zkCommitment.id,
    operatorId: calc.operatorId,
    commitmentHash: commitment.commitmentHash,
    metadata: {
      mode: commitment.verificationMode,
      hashAlgorithm: commitment.hashAlgorithm,
      periodLabel: calc.periodLabel,
      poseidonInputDigest: commitment.poseidonInputDigest,
    },
  });

  res.json({ success: true, data: { payroll: updatedPayroll, zkCommitment, zkRecord } });
});

zkRouter.post('/generate-proof', async (req, res) => {
  const { payrollCalculationId } = z.object({ payrollCalculationId: z.string() }).parse(req.body);
  const calc = await prisma.payrollCalculation.findUnique({
    where: { id: payrollCalculationId },
    include: { operator: true, zkRecord: true, zkCommitment: true },
  });
  if (!calc) return res.status(404).json({ success: false, error: 'Payroll calculation not found' });
  if (!calc.commitmentHash || !calc.periodHash || !calc.zkRecord || !calc.zkCommitment) {
    return res.status(400).json({ success: false, error: 'Commitment must be generated first' });
  }

  const proofResult = await zkService.generateProof({
    operatorPseudoCode: calc.operator.pseudonymousCode,
    processedPairs: calc.processedPairs,
    ratePerPair: calc.ratePerPair,
    bonus: calc.bonus,
    penalty: calc.penalty,
    expectedPayment: calc.expectedPayment,
    periodLabel: calc.periodLabel,
    commitmentHash: calc.commitmentHash,
    periodHash: calc.periodHash,
    nonce: calc.zkCommitment.nonce,
    verificationMode,
  });

  const [updatedPayroll, updatedZk] = await prisma.$transaction([
    prisma.payrollCalculation.update({
      where: { id: payrollCalculationId },
      data: { proofStatus: proofResult.success ? 'GENERATED' : 'FAILED', verificationMode },
    }),
    prisma.zkVerification.update({
      where: { payrollCalculationId },
      data: {
        proofStatus: proofResult.success ? 'GENERATED' : 'FAILED',
        proofData: JSON.stringify(proofResult.proof),
        publicSignals: JSON.stringify(proofResult.publicSignals),
        verificationMode,
      },
    }),
  ]);

  await createAuditEvent({
    eventType: 'PROOF_GENERATED',
    entityType: 'ZkVerification',
    entityId: updatedZk.id,
    operatorId: calc.operatorId,
    commitmentHash: calc.commitmentHash,
    metadata: { mode: verificationMode, success: proofResult.success },
  });

  res.json({ success: true, data: { payroll: updatedPayroll, zk: updatedZk, proof: proofResult } });
});

zkRouter.post('/verify-on-stellar', async (req, res) => {
  const { payrollCalculationId } = z.object({ payrollCalculationId: z.string() }).parse(req.body);
  const calc = await prisma.payrollCalculation.findUnique({
    where: { id: payrollCalculationId },
    include: { zkRecord: true, zkCommitment: true },
  });
  if (!calc?.zkRecord || !calc.zkCommitment) {
    return res.status(404).json({ success: false, error: 'ZK record not found' });
  }
  if (calc.zkRecord.proofStatus !== 'GENERATED') {
    return res.status(400).json({ success: false, error: 'Proof must be generated before verification' });
  }

  await prisma.zkVerification.update({
    where: { payrollCalculationId },
    data: { proofStatus: 'VERIFYING' },
  });

  const stellarResult = await stellarService.verifyPayroll({
    commitmentHash: calc.zkRecord.commitmentHash,
    periodHash: calc.zkRecord.periodHash,
    proofData: JSON.parse(calc.zkRecord.proofData || '{}'),
    publicSignals: JSON.parse(calc.zkRecord.publicSignals || '[]'),
    verificationMode,
  });

  const verifiedAt = new Date();
  const [updatedPayroll, updatedZk, stellarSubmission] = await prisma.$transaction([
    prisma.payrollCalculation.update({
      where: { id: payrollCalculationId },
      data: {
        proofStatus: stellarResult.success ? 'VERIFIED' : 'FAILED',
        verificationStatus: stellarResult.status,
        verificationMode,
        stellarTxHash: stellarResult.txHash,
        stellarContractId: stellarResult.contractId,
        verifiedAt: stellarResult.success ? verifiedAt : null,
      },
    }),
    prisma.zkVerification.update({
      where: { payrollCalculationId },
      data: {
        proofStatus: stellarResult.success ? 'VERIFIED' : 'FAILED',
        verificationMode,
        stellarTxHash: stellarResult.txHash,
        stellarContractId: stellarResult.contractId,
        verifiedAt: stellarResult.success ? verifiedAt : null,
      },
    }),
    prisma.stellarSubmission.create({
      data: {
        zkCommitmentId: calc.zkCommitment.id,
        payrollCalculationId,
        txHash: stellarResult.txHash,
        contractId: stellarResult.contractId,
        status: stellarResult.status,
        mode: verificationMode,
        ledger: stellarResult.ledger,
      },
    }),
  ]);

  await createAuditEvent({
    eventType: stellarResult.success ? 'PROOF_VERIFIED' : 'STELLAR_SUBMITTED',
    entityType: 'StellarSubmission',
    entityId: stellarSubmission.id,
    operatorId: calc.operatorId,
    commitmentHash: calc.zkRecord.commitmentHash,
    metadata: {
      mode: verificationMode,
      txHash: stellarResult.txHash,
      contractId: stellarResult.contractId,
      ledger: stellarResult.ledger,
    },
  });

  res.json({
    success: true,
    data: { payroll: updatedPayroll, zk: updatedZk, stellar: stellarResult, stellarSubmission },
  });
});
