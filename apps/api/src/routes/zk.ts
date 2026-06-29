import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { createAuditEvent } from '../lib/audit';
import { readEnv } from '../lib/stellar-env';
import { ZkFlowError, zkService } from '../services/zk.service';

export const zkRouter = Router();

const payrollBody = z.object({ payrollCalculationId: z.string() });
const proofBody = z.object({
  zkProofId: z.string().optional(),
  payrollCalculationId: z.string().optional(),
});

function stellarExplorerUrl(txHash: string | null | undefined): string | null {
  return txHash ? `https://stellar.expert/explorer/testnet/tx/${txHash}` : null;
}

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, ' ').slice(0, 500);
}

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
      generatedProofs: payrolls.filter(p => ['PROOF_GENERATED', 'OFFCHAIN_VERIFIED', 'STELLAR_PENDING', 'STELLAR_VERIFIED'].includes(
        zkService.normalizeProofStatus({
          proofStatus: p.proofStatus,
          commitmentHash: p.commitmentHash,
          stellarTxHash: p.stellarTxHash,
        }),
      )).length,
      verifiedOnchain: payrolls.filter(p => zkService.normalizeProofStatus({
        proofStatus: p.proofStatus,
        commitmentHash: p.commitmentHash,
        stellarTxHash: p.stellarTxHash,
      }) === 'STELLAR_VERIFIED').length,
      latestCommitmentHash: proofs[0]?.commitmentHash ?? null,
      mode: verifications[0]?.verificationMode ?? readEnv('VERIFICATION_MODE', 'SIMULATED'),
    },
  });
});

zkRouter.get('/queue', async (_req, res) => {
  const payrolls = await prisma.payrollCalculation.findMany({
    include: { operator: true, zkRecord: true, zkCommitment: true, zkProofs: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({
    success: true,
    data: payrolls.map(payroll => {
      const latestProof = [...payroll.zkProofs].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
      return {
        ...payroll,
        proofStatus: zkService.normalizeProofStatus({
          proofStatus: latestProof?.proofStatus ?? payroll.proofStatus,
          commitmentHash: latestProof?.commitmentHash ?? payroll.commitmentHash,
          proofJson: latestProof?.proofJson,
          publicSignals: latestProof?.publicSignals,
          offchainVerified: Boolean(latestProof?.verifiedOffchainAt),
          stellarTxHash: payroll.stellarTxHash,
          proofData: payroll.zkRecord?.proofData,
        }),
      };
    }),
  });
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
    proofStatus: zkService.normalizeProofStatus({
      proofStatus: proof.proofStatus,
      commitmentHash: proof.commitmentHash,
      proofJson: proof.proofJson,
      publicSignals: proof.publicSignals,
      offchainVerified: Boolean(proof.verifiedOffchainAt),
      stellarTxHash: proof.onchainVerification?.stellarTxHash ?? proof.payrollCalculation.stellarTxHash,
      onchainStatus: proof.onchainVerification?.status,
      eventConfirmed: proof.onchainVerification?.eventConfirmed,
      stateConfirmed: proof.onchainVerification?.status === 'STELLAR_VERIFIED',
      proofData: proof.payrollCalculation.zkCommitment ? JSON.stringify(proof.proofJson ?? null) : null,
    }),
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

  await createAuditEvent({
    eventType: 'PROOF_VERIFIED',
    entityType: 'ZkProof',
    entityId: zkProofId,
    commitmentHash: result.zkProof.commitmentHash,
    metadata: {
      proofStatus: result.zkProof.proofStatus,
      offchainVerified: result.offchainVerified,
    },
  });

  res.json({
    zkProofId,
    proofStatus: result.zkProof.proofStatus,
    offchainVerified: result.offchainVerified,
  });
});

zkRouter.post('/verify-on-stellar', async (req, res) => {
  let zkProofId: string | null = null;
  try {
    zkProofId = await resolveZkProofId(proofBody.parse(req.body));
    const proof = await prisma.zkProof.findUnique({ where: { id: zkProofId } });

    await createAuditEvent({
      eventType: 'STELLAR_SUBMISSION_STARTED',
      entityType: 'ZkProof',
      entityId: zkProofId,
      commitmentHash: proof?.commitmentHash,
      metadata: {
        proofStatus: proof?.proofStatus,
        verificationMode: readEnv('VERIFICATION_MODE', 'SIMULATED'),
      },
    });

    const result = await zkService.submitProofToStellar(zkProofId);
    const txHash = result.onchainVerification.stellarTxHash;

    await createAuditEvent({
      eventType: 'STELLAR_SUBMISSION_FINISHED',
      entityType: 'ZkProof',
      entityId: zkProofId,
      commitmentHash: result.onchainVerification.commitmentHash,
      metadata: {
        proofStatus: result.onchainVerification.status,
        verificationMode: result.onchainVerification.verificationMode,
        txHash,
        ledger: result.onchainVerification.ledger,
        eventConfirmed: result.stellar.eventConfirmed ?? result.onchainVerification.eventConfirmed,
        stateConfirmed: result.stellar.stateConfirmed ?? false,
        confirmationSource: result.stellar.confirmationSource ?? 'none',
      },
    });

    res.json({
      zkProofId,
      verificationMode: result.onchainVerification.verificationMode,
      status: result.onchainVerification.status,
      proofStatus: result.onchainVerification.status,
      stellarTxHash: txHash,
      stellarExplorerUrl: stellarExplorerUrl(txHash),
      ledger: result.onchainVerification.ledger,
      eventConfirmed: result.stellar.eventConfirmed ?? result.onchainVerification.eventConfirmed,
      stateConfirmed: result.stellar.stateConfirmed ?? false,
      confirmationSource: result.stellar.confirmationSource ?? 'none',
      commitmentHash: result.stellar.commitmentHash ?? result.onchainVerification.commitmentHash,
      periodHash: result.stellar.periodHash ?? result.onchainVerification.periodHash,
      contractId: result.onchainVerification.contractId,
    });
  } catch (error) {
    const statusCode = error instanceof ZkFlowError ? error.statusCode : 500;
    const message = error instanceof ZkFlowError
      ? error.message
      : 'Unable to submit proof to Stellar registry.';
    const errorMessage = safeErrorMessage(error);

    if (zkProofId) {
      const proof = await prisma.zkProof.findUnique({ where: { id: zkProofId } });
      await createAuditEvent({
        eventType: 'STELLAR_SUBMISSION_FAILED',
        entityType: 'ZkProof',
        entityId: zkProofId,
        commitmentHash: proof?.commitmentHash,
        metadata: {
          proofStatus: error instanceof ZkFlowError ? error.proofStatus : proof?.proofStatus,
          errorMessage,
        },
      });
    }

    res.status(statusCode).json({
      success: false,
      error: message,
      errorMessage,
      proofStatus: error instanceof ZkFlowError ? error.proofStatus : undefined,
    });
  }
});
