import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { createAuditEvent } from '../lib/audit';
import { zkService } from '../services/zk.service';
import { stellarService } from '../services/stellar.service';
import { z } from 'zod';

export const zkRouter = Router();

// GET /api/zk/verifications
zkRouter.get('/verifications', async (_req, res) => {
  const verifications = await prisma.zkVerification.findMany({
    orderBy: { createdAt: 'desc' },
    include: { payrollCalculation: { include: { operator: true } } },
  });
  res.json({ success: true, data: verifications });
});

// GET /api/zk/verifications/:id
zkRouter.get('/verifications/:id', async (req, res) => {
  const v = await prisma.zkVerification.findUnique({
    where: { id: req.params.id },
    include: { payrollCalculation: { include: { operator: true } } },
  });
  if (!v) return res.status(404).json({ success: false, error: 'Verification not found' });
  res.json({ success: true, data: v });
});

// POST /api/zk/generate-commitment
zkRouter.post('/generate-commitment', async (req, res) => {
  const schema = z.object({ payrollCalculationId: z.string() });
  const { payrollCalculationId } = schema.parse(req.body);

  const calc = await prisma.payrollCalculation.findUnique({
    where: { id: payrollCalculationId },
    include: { operator: true },
  });
  if (!calc) return res.status(404).json({ success: false, error: 'Payroll calculation not found' });

  // Generate Poseidon commitment (or SHA256 in simulation mode)
  const { commitmentHash, periodHash, nonce } = await zkService.generateCommitment({
    operatorPseudoCode: calc.operator.pseudonymousCode,
    processedPairs: calc.processedPairs,
    ratePerPair: calc.ratePerPair,
    bonus: calc.bonus,
    penalty: calc.penalty,
    expectedPayment: calc.expectedPayment,
    periodLabel: calc.periodLabel,
  });

  // Update payroll calculation
  const updated = await prisma.payrollCalculation.update({
    where: { id: payrollCalculationId },
    data: { commitmentHash, periodHash, proofStatus: 'GENERATING' },
  });

  // Create ZK verification record
  const zkRecord = await prisma.zkVerification.upsert({
    where: { payrollCalculationId },
    update: { commitmentHash, periodHash, proofStatus: 'GENERATING' },
    create: {
      payrollCalculationId,
      commitmentHash,
      periodHash,
      proofStatus: 'GENERATING',
      verificationMode: process.env.VERIFICATION_MODE || 'SIMULATED',
    },
  });

  await createAuditEvent({
    eventType: 'COMMITMENT_GENERATED',
    entityType: 'ZkVerification',
    entityId: zkRecord.id,
    operatorId: calc.operatorId,
    commitmentHash,
    metadata: { mode: process.env.VERIFICATION_MODE || 'SIMULATED', nonce, periodLabel: calc.periodLabel },
  });

  res.json({ success: true, data: { ...updated, zkRecord } });
});

// POST /api/zk/generate-proof
zkRouter.post('/generate-proof', async (req, res) => {
  const schema = z.object({ payrollCalculationId: z.string() });
  const { payrollCalculationId } = schema.parse(req.body);

  const calc = await prisma.payrollCalculation.findUnique({
    where: { id: payrollCalculationId },
    include: { operator: true, zkRecord: true },
  });
  if (!calc) return res.status(404).json({ success: false, error: 'Payroll calculation not found' });
  if (!calc.commitmentHash) {
    return res.status(400).json({ success: false, error: 'Commitment must be generated first' });
  }

  const verificationMode = process.env.VERIFICATION_MODE || 'SIMULATED';

  const proofResult = await zkService.generateProof({
    operatorPseudoCode: calc.operator.pseudonymousCode,
    processedPairs: calc.processedPairs,
    ratePerPair: calc.ratePerPair,
    bonus: calc.bonus,
    penalty: calc.penalty,
    expectedPayment: calc.expectedPayment,
    periodLabel: calc.periodLabel,
    commitmentHash: calc.commitmentHash,
    periodHash: calc.periodHash!,
    verificationMode,
  });

  // Update records
  const [updatedCalc, updatedZk] = await Promise.all([
    prisma.payrollCalculation.update({
      where: { id: payrollCalculationId },
      data: { proofStatus: proofResult.success ? 'GENERATED' : 'FAILED' },
    }),
    prisma.zkVerification.update({
      where: { payrollCalculationId },
      data: {
        proofStatus: proofResult.success ? 'GENERATED' : 'FAILED',
        proofData: JSON.stringify(proofResult.proof),
        publicSignals: JSON.stringify(proofResult.publicSignals),
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

  res.json({ success: true, data: { payroll: updatedCalc, zk: updatedZk, proof: proofResult } });
});

// POST /api/zk/verify-on-stellar
zkRouter.post('/verify-on-stellar', async (req, res) => {
  const schema = z.object({ payrollCalculationId: z.string() });
  const { payrollCalculationId } = schema.parse(req.body);

  const calc = await prisma.payrollCalculation.findUnique({
    where: { id: payrollCalculationId },
    include: { zkRecord: true },
  });
  if (!calc?.zkRecord) return res.status(404).json({ success: false, error: 'ZK record not found' });
  if (calc.zkRecord.proofStatus !== 'GENERATED') {
    return res.status(400).json({ success: false, error: 'Proof must be generated before Stellar verification' });
  }

  // Update status to verifying
  await prisma.zkVerification.update({
    where: { payrollCalculationId },
    data: { proofStatus: 'VERIFYING' },
  });

  const verificationMode = process.env.VERIFICATION_MODE || 'SIMULATED';
  const stellarResult = await stellarService.verifyPayroll({
    commitmentHash: calc.zkRecord.commitmentHash,
    periodHash: calc.zkRecord.periodHash,
    proofData: JSON.parse(calc.zkRecord.proofData || '{}'),
    publicSignals: JSON.parse(calc.zkRecord.publicSignals || '[]'),
    verificationMode,
  });

  const verifiedAt = new Date();
  const [updatedCalc, updatedZk] = await Promise.all([
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
  ]);

  await createAuditEvent({
    eventType: stellarResult.success ? 'PROOF_VERIFIED' : 'STELLAR_SUBMITTED',
    entityType: 'ZkVerification',
    entityId: updatedZk.id,
    operatorId: calc.operatorId,
    commitmentHash: calc.zkRecord.commitmentHash,
    metadata: { mode: verificationMode, txHash: stellarResult.txHash, contractId: stellarResult.contractId },
  });

  res.json({ success: true, data: { payroll: updatedCalc, zk: updatedZk, stellar: stellarResult } });
});
