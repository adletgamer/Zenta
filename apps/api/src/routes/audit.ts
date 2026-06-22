import { Router } from 'express';
import { prisma } from '../lib/prisma';

export const auditRouter = Router();

// GET /api/audit
auditRouter.get('/', async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;

  const [events, total] = await Promise.all([
    prisma.auditEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: { operator: true, productionLot: true },
    }),
    prisma.auditEvent.count(),
  ]);

  const entityIds = events.map(event => event.entityId);
  const hashes = events.map(event => event.commitmentHash).filter((hash): hash is string => Boolean(hash));

  const [payrolls, verifications] = await Promise.all([
    prisma.payrollCalculation.findMany({
      where: { id: { in: entityIds } },
      select: { id: true, commitmentHash: true, proofStatus: true, verificationStatus: true },
    }),
    prisma.zkVerification.findMany({
      where: {
        OR: [
          { id: { in: entityIds } },
          { commitmentHash: { in: hashes } },
        ],
      },
      select: { id: true, commitmentHash: true, proofStatus: true },
    }),
  ]);

  const payrollById = new Map(payrolls.map(payroll => [payroll.id, payroll]));
  const verificationById = new Map(verifications.map(verification => [verification.id, verification]));
  const verificationByHash = new Map(verifications.map(verification => [verification.commitmentHash, verification]));

  const parsed = events.map(event => {
    const metadata = JSON.parse(event.metadata || '{}');
    const payroll = payrollById.get(event.entityId);
    const verification = verificationById.get(event.entityId) || (event.commitmentHash ? verificationByHash.get(event.commitmentHash) : undefined);

    return {
      ...event,
      timestamp: event.createdAt,
      commitmentHash: event.commitmentHash || payroll?.commitmentHash || verification?.commitmentHash || null,
      proofStatus: payroll?.proofStatus || verification?.proofStatus || metadata.proofStatus || null,
      verificationStatus: payroll?.verificationStatus || metadata.verificationStatus || null,
      metadata,
    };
  });

  res.json({ success: true, data: parsed, total, page: Math.floor(offset / limit) + 1 });
});

// GET /api/audit/:id
auditRouter.get('/:id', async (req, res) => {
  const event = await prisma.auditEvent.findUnique({
    where: { id: req.params.id },
    include: { operator: true, productionLot: true },
  });
  if (!event) return res.status(404).json({ success: false, error: 'Audit event not found' });
  res.json({ success: true, data: { ...event, metadata: JSON.parse(event.metadata) } });
});
