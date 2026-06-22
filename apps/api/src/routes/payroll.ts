import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { createAuditEvent } from '../lib/audit';
import { z } from 'zod';

export const payrollRouter = Router();

// GET /api/payroll/summary
payrollRouter.get('/summary', async (_req, res) => {
  const calcs = await prisma.payrollCalculation.findMany();
  const summary = {
    totalOperators: new Set(calcs.map(c => c.operatorId)).size,
    totalPairs: calcs.reduce((s, c) => s + c.processedPairs, 0),
    totalEarned: calcs.reduce((s, c) => s + c.expectedPayment, 0),
    totalPaid: calcs.reduce((s, c) => s + c.paidAmount, 0),
    totalPending: calcs.reduce((s, c) => s + c.pendingBalance, 0),
    verifiedPayrolls: calcs.filter(c => c.proofStatus === 'VERIFIED').length,
    periodLabel: 'Week 1 - June 2025',
  };
  res.json({ success: true, data: summary });
});

// GET /api/payroll/operators
payrollRouter.get('/operators', async (_req, res) => {
  const calcs = await prisma.payrollCalculation.findMany({
    include: { operator: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: calcs });
});

// POST /api/payroll/calculate
payrollRouter.post('/calculate', async (req, res) => {
  const schema = z.object({
    operatorId: z.string(),
    periodLabel: z.string(),
    periodStart: z.string(),
    periodEnd: z.string(),
    bonus: z.number().nonnegative().default(0),
    penalty: z.number().nonnegative().default(0),
  });
  const body = schema.parse(req.body);

  // Get operator and their specialization
  const operator = await prisma.operator.findUnique({ where: { id: body.operatorId } });
  if (!operator) return res.status(404).json({ success: false, error: 'Operator not found' });

  // Get current rate for operator's specialization
  const rate = await prisma.stageRate.findUnique({ where: { stage: operator.specialization } });
  if (!rate) return res.status(400).json({ success: false, error: 'No rate configured for this specialization' });

  // Sum all processed pairs in the period
  const start = new Date(body.periodStart);
  const end = new Date(body.periodEnd);
  const assignments = await prisma.operatorAssignment.findMany({
    where: {
      operatorId: body.operatorId,
      assignedAt: { gte: start, lte: end },
    },
  });
  const processedPairs = assignments.reduce((s, a) => s + a.processedPairs, 0);

  const expectedPayment = processedPairs * rate.ratePerPair + body.bonus - body.penalty;

  // Get already paid amount for this period
  const existing = await prisma.payrollCalculation.findFirst({
    where: { operatorId: body.operatorId, periodLabel: body.periodLabel },
  });
  const paidAmount = existing?.paidAmount || 0;
  const pendingBalance = Math.max(0, expectedPayment - paidAmount);

  // Upsert payroll calculation
  const calc = await prisma.payrollCalculation.upsert({
    where: { id: existing?.id || 'new-' + Date.now() },
    update: {
      processedPairs,
      ratePerPair: rate.ratePerPair,
      bonus: body.bonus,
      penalty: body.penalty,
      expectedPayment,
      pendingBalance,
    },
    create: {
      operatorId: body.operatorId,
      periodLabel: body.periodLabel,
      periodStart: start,
      periodEnd: end,
      processedPairs,
      ratePerPair: rate.ratePerPair,
      bonus: body.bonus,
      penalty: body.penalty,
      expectedPayment,
      paidAmount,
      pendingBalance,
      proofStatus: 'NOT_GENERATED',
      verificationMode: 'SIMULATED',
    },
    include: { operator: true },
  });

  await createAuditEvent({
    eventType: 'PAYROLL_CALCULATED',
    entityType: 'PayrollCalculation',
    entityId: calc.id,
    operatorId: body.operatorId,
    metadata: { pairs: processedPairs, rate: rate.ratePerPair, amount: expectedPayment, period: body.periodLabel },
  });

  res.status(201).json({ success: true, data: calc });
});

// POST /api/payroll/payments
payrollRouter.post('/payments', async (req, res) => {
  const schema = z.object({
    operatorId: z.string(),
    payrollCalculationId: z.string().optional(),
    amount: z.number().positive(),
    method: z.enum(['CASH', 'TRANSFER', 'VOUCHER']),
    reference: z.string().optional(),
    notes: z.string().optional(),
  });
  const body = schema.parse(req.body);

  const operator = await prisma.operator.findUnique({ where: { id: body.operatorId } });
  if (!operator) return res.status(404).json({ success: false, error: 'Operator not found' });

  const payment = await prisma.payment.create({
    data: {
      operatorId: body.operatorId,
      payrollCalculationId: body.payrollCalculationId,
      amount: body.amount,
      method: body.method,
      reference: body.reference,
      notes: body.notes,
    },
    include: { operator: true },
  });

  // Update payroll calculation paid amount
  if (body.payrollCalculationId) {
    const calc = await prisma.payrollCalculation.findUnique({
      where: { id: body.payrollCalculationId },
    });
    if (calc) {
      const newPaid = calc.paidAmount + body.amount;
      const newPending = Math.max(0, calc.expectedPayment - newPaid);
      await prisma.payrollCalculation.update({
        where: { id: body.payrollCalculationId },
        data: { paidAmount: newPaid, pendingBalance: newPending },
      });
    }
  }

  await createAuditEvent({
    eventType: 'PAYMENT_REGISTERED',
    entityType: 'Payment',
    entityId: payment.id,
    operatorId: body.operatorId,
    metadata: { amount: body.amount, method: body.method, reference: body.reference },
  });

  res.status(201).json({ success: true, data: payment });
});
