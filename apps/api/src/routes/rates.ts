import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { createAuditEvent } from '../lib/audit';
import { z } from 'zod';

export const ratesRouter = Router();

// GET /api/rates
ratesRouter.get('/', async (_req, res) => {
  const rates = await prisma.stageRate.findMany({
    where: { active: true },
    orderBy: { stage: 'asc' },
  });
  res.json({ success: true, data: rates });
});

// GET /api/rates/history
ratesRouter.get('/history', async (_req, res) => {
  const events = await prisma.auditEvent.findMany({
    where: { eventType: 'RATE_UPDATED' },
    orderBy: { createdAt: 'desc' },
    take: 25,
  });

  const history = events.map(event => ({
    id: event.id,
    timestamp: event.createdAt,
    metadata: JSON.parse(event.metadata || '{}'),
  }));

  res.json({ success: true, data: history });
});

// PUT /api/rates/:stage
ratesRouter.put('/:stage', async (req, res) => {
  const schema = z.object({ ratePerPair: z.number().positive() });
  const body = schema.parse(req.body);

  const validStages = ['CUTTING', 'STITCHING', 'ASSEMBLY', 'SOLE_ATTACHMENT', 'FINISHING'];
  if (!validStages.includes(req.params.stage)) {
    return res.status(400).json({ success: false, error: 'Invalid stage' });
  }

  // Expire old rate
  const existing = await prisma.stageRate.findUnique({ where: { stage: req.params.stage } });
  if (existing) {
    await prisma.stageRate.update({
      where: { stage: req.params.stage },
      data: { validTo: new Date() },
    });
  }

  // Create new versioned rate
  const newVersion = existing ? existing.version + 1 : 1;
  const rate = await prisma.stageRate.upsert({
    where: { stage: req.params.stage },
    update: {
      ratePerPair: body.ratePerPair,
      version: newVersion,
      validFrom: new Date(),
      validTo: null,
      active: true,
    },
    create: {
      stage: req.params.stage,
      ratePerPair: body.ratePerPair,
      version: 1,
      validFrom: new Date(),
      active: true,
    },
  });

  await createAuditEvent({
    eventType: 'RATE_UPDATED',
    entityType: 'StageRate',
    entityId: rate.id,
    metadata: { stage: req.params.stage, newRate: body.ratePerPair, version: newVersion },
  });

  res.json({ success: true, data: rate });
});
