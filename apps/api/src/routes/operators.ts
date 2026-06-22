import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { createAuditEvent } from '../lib/audit';
import { z } from 'zod';
import crypto from 'crypto';

export const operatorsRouter = Router();

// GET /api/operators
operatorsRouter.get('/', async (_req, res) => {
  const operators = await prisma.operator.findMany({
    orderBy: { displayName: 'asc' },
    include: {
      assignments: {
        select: { id: true, processedPairs: true, completedAt: true },
      },
      payrollCalculations: {
        select: { expectedPayment: true, paidAmount: true, pendingBalance: true },
      },
    },
  });

  // Enrich with computed stats
  const enriched = operators.map(op => ({
    ...op,
    totalProcessedPairs: op.assignments.reduce((sum, a) => sum + a.processedPairs, 0),
    totalTasksCompleted: op.assignments.filter(a => a.completedAt !== null).length,
    activeAssignments: op.assignments.filter(a => a.completedAt === null).length,
    totalEarned: op.payrollCalculations.reduce((sum, p) => sum + p.expectedPayment, 0),
    totalPaid: op.payrollCalculations.reduce((sum, p) => sum + p.paidAmount, 0),
    pendingBalance: op.payrollCalculations.reduce((sum, p) => sum + p.pendingBalance, 0),
  }));

  res.json({ success: true, data: enriched });
});

// GET /api/operators/:id
operatorsRouter.get('/:id', async (req, res) => {
  const operator = await prisma.operator.findUnique({
    where: { id: req.params.id },
    include: {
      assignments: {
        include: { productionLot: true },
        orderBy: { assignedAt: 'desc' },
      },
      payrollCalculations: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      payments: {
        orderBy: { paidAt: 'desc' },
        take: 10,
      },
    },
  });
  if (!operator) return res.status(404).json({ success: false, error: 'Operator not found' });
  res.json({ success: true, data: operator });
});

// POST /api/operators
operatorsRouter.post('/', async (req, res) => {
  const schema = z.object({
    displayName: z.string().min(2),
    specialization: z.enum(['CUTTING', 'STITCHING', 'ASSEMBLY', 'SOLE_ATTACHMENT', 'FINISHING']),
  });

  const body = schema.parse(req.body);
  const pseudonymousCode = 'OP-' + crypto.createHash('sha256')
    .update(body.displayName + Date.now())
    .digest('hex')
    .substring(0, 6)
    .toUpperCase();

  const operator = await prisma.operator.create({
    data: {
      displayName: body.displayName,
      specialization: body.specialization,
      pseudonymousCode,
      active: true,
    },
  });

  res.status(201).json({ success: true, data: operator });
});

// POST /api/operators/:id/assign-lot
operatorsRouter.post('/:id/assign-lot', async (req, res) => {
  const schema = z.object({
    productionLotId: z.string(),
    processedPairs: z.number().int().nonnegative(),
  });
  const body = schema.parse(req.body);

  const operator = await prisma.operator.findUnique({ where: { id: req.params.id } });
  if (!operator) return res.status(404).json({ success: false, error: 'Operator not found' });
  if (!operator.active) return res.status(400).json({ success: false, error: 'Operator is inactive' });

  const lot = await prisma.productionLot.findUnique({ where: { id: body.productionLotId } });
  if (!lot) return res.status(404).json({ success: false, error: 'Production lot not found' });
  if (lot.status === 'COMPLETED' || lot.status === 'CANCELLED') {
    return res.status(400).json({ success: false, error: 'Lot is not available for assignment' });
  }

  const assignment = await prisma.operatorAssignment.create({
    data: {
      operatorId: operator.id,
      productionLotId: lot.id,
      fromStage: lot.currentStage,
      processedPairs: body.processedPairs,
    },
    include: { operator: true, productionLot: true },
  });

  await createAuditEvent({
    eventType: 'OPERATOR_ASSIGNED',
    entityType: 'OperatorAssignment',
    entityId: assignment.id,
    operatorId: operator.id,
    productionLotId: lot.id,
    metadata: { stage: lot.currentStage, pairs: body.processedPairs, lotCode: lot.lotCode },
  });

  res.status(201).json({ success: true, data: assignment });
});
