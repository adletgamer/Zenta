import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { createAuditEvent } from '../lib/audit';
import { z } from 'zod';

export const lotsRouter = Router();

const STAGE_ORDER = ['QUEUE', 'CUTTING', 'STITCHING', 'ASSEMBLY', 'SOLE_ATTACHMENT', 'FINISHING', 'COMPLETED'];

// GET /api/lots
lotsRouter.get('/', async (_req, res) => {
  const lots = await prisma.productionLot.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      assignments: {
        include: { operator: true },
        orderBy: { assignedAt: 'desc' },
        take: 3,
      },
    },
  });
  res.json({ success: true, data: lots });
});

// GET /api/lots/:id
lotsRouter.get('/:id', async (req, res) => {
  const lot = await prisma.productionLot.findUnique({
    where: { id: req.params.id },
    include: {
      assignments: {
        include: { operator: true },
        orderBy: { assignedAt: 'desc' },
      },
      auditEvents: { orderBy: { createdAt: 'desc' }, take: 20 },
    },
  });
  if (!lot) return res.status(404).json({ success: false, error: 'Lot not found' });
  res.json({ success: true, data: lot });
});

// POST /api/lots
lotsRouter.post('/', async (req, res) => {
  const schema = z.object({
    lotCode: z.string().min(1).max(20),
    plannedDate: z.string(),
    model: z.string().min(1),
    color: z.string().min(1),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
    sizeCurve: z.string().default('Standard'),
    totalPairs: z.number().int().positive(),
    estimatedMaterial: z.number().nonnegative().default(0),
    estimatedLaborHours: z.number().nonnegative().default(0),
    notes: z.string().optional(),
  });

  const body = schema.parse(req.body);
  const lot = await prisma.productionLot.create({
    data: {
      lotCode: body.lotCode,
      model: body.model,
      color: body.color,
      priority: body.priority,
      sizeCurve: body.sizeCurve,
      totalPairs: body.totalPairs,
      estimatedMaterial: body.estimatedMaterial,
      estimatedLaborHours: body.estimatedLaborHours,
      notes: body.notes,
      plannedDate: new Date(body.plannedDate),
      currentStage: 'QUEUE',
      status: 'ACTIVE',
    },
  });

  await createAuditEvent({
    eventType: 'LOT_CREATED',
    entityType: 'ProductionLot',
    entityId: lot.id,
    productionLotId: lot.id,
    metadata: { lotCode: lot.lotCode, model: lot.model, totalPairs: lot.totalPairs },
  });

  res.status(201).json({ success: true, data: lot });
});

// PATCH /api/lots/:id/advance
lotsRouter.patch('/:id/advance', async (req, res) => {
  const schema = z.object({
    processedPairs: z.number().int().nonnegative().default(0),
    operatorId: z.string().optional(),
    notes: z.string().optional(),
  });
  const body = schema.parse(req.body);

  const lot = await prisma.productionLot.findUnique({ where: { id: req.params.id } });
  if (!lot) return res.status(404).json({ success: false, error: 'Lot not found' });
  if (lot.currentStage === 'COMPLETED') {
    return res.status(400).json({ success: false, error: 'Lot is already completed' });
  }

  const currentIndex = STAGE_ORDER.indexOf(lot.currentStage);
  const nextStage = STAGE_ORDER[currentIndex + 1];
  const isCompleted = nextStage === 'COMPLETED';

  const updated = await prisma.productionLot.update({
    where: { id: lot.id },
    data: {
      currentStage: nextStage,
      status: isCompleted ? 'COMPLETED' : 'ACTIVE',
    },
  });

  // If an operator is advancing this lot, create an assignment record
  if (body.operatorId) {
    await prisma.operatorAssignment.create({
      data: {
        operatorId: body.operatorId,
        productionLotId: lot.id,
        fromStage: lot.currentStage,
        toStage: nextStage,
        processedPairs: body.processedPairs,
        completedAt: new Date(),
      },
    });
  }

  await createAuditEvent({
    eventType: isCompleted ? 'LOT_COMPLETED' : 'LOT_ADVANCED',
    entityType: 'ProductionLot',
    entityId: lot.id,
    operatorId: body.operatorId,
    productionLotId: lot.id,
    metadata: { from: lot.currentStage, to: nextStage, processedPairs: body.processedPairs, notes: body.notes },
  });

  res.json({ success: true, data: updated });
});

// DELETE /api/lots/:id
lotsRouter.delete('/:id', async (req, res) => {
  const lot = await prisma.productionLot.findUnique({ where: { id: req.params.id } });
  if (!lot) return res.status(404).json({ success: false, error: 'Lot not found' });
  if (lot.status === 'COMPLETED') {
    return res.status(400).json({ success: false, error: 'Cannot delete a completed lot' });
  }

  await prisma.productionLot.update({
    where: { id: req.params.id },
    data: { status: 'CANCELLED' },
  });

  res.json({ success: true, message: 'Lot cancelled successfully' });
});
