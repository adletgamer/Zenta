/**
 * Zenta Database Seed
 * Seeds demo data for the Zenta ERP MVP
 */
import { PrismaClient } from '../generated/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Helper to generate pseudonymous operator codes
function generatePseudoCode(name: string): string {
  return 'OP-' + crypto.createHash('sha256').update(name).digest('hex').substring(0, 6).toUpperCase();
}

async function main() {
  console.log('🌱 Seeding Zenta database...');

  // ---- Clean existing data (order matters for FK constraints) ----
  await prisma.stellarSubmission.deleteMany();
  await prisma.zkCommitment.deleteMany();
  await prisma.zkVerification.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.payrollCalculation.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.operatorAssignment.deleteMany();
  await prisma.productionLot.deleteMany();
  await prisma.stageRate.deleteMany();
  await prisma.operator.deleteMany();

  // ---- Stage Rates -----------------------------------------------
  console.log('  Creating stage rates...');
  const rates = await Promise.all([
    prisma.stageRate.create({
      data: { stage: 'CUTTING', ratePerPair: 2.00, version: 1, validFrom: new Date('2025-01-01') },
    }),
    prisma.stageRate.create({
      data: { stage: 'STITCHING', ratePerPair: 6.00, version: 1, validFrom: new Date('2025-01-01') },
    }),
    prisma.stageRate.create({
      data: { stage: 'ASSEMBLY', ratePerPair: 3.00, version: 1, validFrom: new Date('2025-01-01') },
    }),
    prisma.stageRate.create({
      data: { stage: 'SOLE_ATTACHMENT', ratePerPair: 3.00, version: 1, validFrom: new Date('2025-01-01') },
    }),
    prisma.stageRate.create({
      data: { stage: 'FINISHING', ratePerPair: 1.50, version: 1, validFrom: new Date('2025-01-01') },
    }),
  ]);
  console.log(`  ✓ Created ${rates.length} stage rates`);

  // ---- Operators -------------------------------------------------
  console.log('  Creating operators...');
  const operatorData = [
    { displayName: 'Carlos Mendoza',   specialization: 'CUTTING' },
    { displayName: 'Sofía Aguilar',    specialization: 'CUTTING' },
    { displayName: 'María Torres',     specialization: 'STITCHING' },
    { displayName: 'Eduardo Castillo', specialization: 'STITCHING' },
    { displayName: 'Santiago Vargas',  specialization: 'ASSEMBLY' },
    { displayName: 'Elena Díaz',       specialization: 'FINISHING' },
  ];

  const operators = await Promise.all(
    operatorData.map(op =>
      prisma.operator.create({
        data: {
          pseudonymousCode: generatePseudoCode(op.displayName),
          displayName: op.displayName,
          specialization: op.specialization,
          active: true,
        },
      })
    )
  );
  const [carlos, sofia, maria, eduardo, santiago, elena] = operators;
  console.log(`  ✓ Created ${operators.length} operators`);

  // ---- Production Lots -------------------------------------------
  console.log('  Creating production lots...');
  const lots = await Promise.all([
    prisma.productionLot.create({
      data: {
        lotCode: 'OP-001',
        plannedDate: new Date('2025-06-01'),
        model: 'Urbano Neo',
        color: 'Negro',
        priority: 'NORMAL',
        sizeCurve: '36-37-38-39-40',
        totalPairs: 15,
        currentStage: 'COMPLETED',
        status: 'COMPLETED',
        estimatedMaterial: 450.00,
        estimatedLaborHours: 12.5,
        notes: 'First demo lot — fully completed',
      },
    }),
    prisma.productionLot.create({
      data: {
        lotCode: 'OP-002',
        plannedDate: new Date('2025-06-05'),
        model: 'Augusto S-10',
        color: 'Marrón',
        priority: 'HIGH',
        sizeCurve: '40-41-42-43',
        totalPairs: 15,
        currentStage: 'ASSEMBLY',
        status: 'ACTIVE',
        estimatedMaterial: 520.00,
        estimatedLaborHours: 14.0,
        notes: 'In assembly stage',
      },
    }),
    prisma.productionLot.create({
      data: {
        lotCode: 'OP-003',
        plannedDate: new Date('2025-06-08'),
        model: 'Veloce-X',
        color: 'Azul',
        priority: 'NORMAL',
        sizeCurve: '38-39-40-41-42',
        totalPairs: 15,
        currentStage: 'STITCHING',
        status: 'ACTIVE',
        estimatedMaterial: 480.00,
        estimatedLaborHours: 13.0,
      },
    }),
    prisma.productionLot.create({
      data: {
        lotCode: 'OP-004',
        plannedDate: new Date('2025-06-10'),
        model: 'Titan B-90',
        color: 'Negro',
        priority: 'URGENT',
        sizeCurve: '41-42-43-44',
        totalPairs: 15,
        currentStage: 'QUEUE',
        status: 'ACTIVE',
        estimatedMaterial: 600.00,
        estimatedLaborHours: 18.0,
        notes: 'Urgent — safety boot order',
      },
    }),
    prisma.productionLot.create({
      data: {
        lotCode: 'OP-005',
        plannedDate: new Date('2025-06-12'),
        model: 'Veloce-X',
        color: 'Rojo',
        priority: 'LOW',
        sizeCurve: '36-37-38-39',
        totalPairs: 15,
        currentStage: 'QUEUE',
        status: 'ACTIVE',
        estimatedMaterial: 470.00,
        estimatedLaborHours: 12.0,
      },
    }),
  ]);
  const [lot001, lot002, lot003] = lots;
  console.log(`  ✓ Created ${lots.length} production lots`);

  // ---- Operator Assignments --------------------------------------
  console.log('  Creating operator assignments...');
  const assignments = await Promise.all([
    // Carlos worked OP-001 (Cutting stage)
    prisma.operatorAssignment.create({
      data: {
        operatorId: carlos.id,
        productionLotId: lot001.id,
        fromStage: 'CUTTING',
        toStage: 'STITCHING',
        processedPairs: 15,
        assignedAt: new Date('2025-06-01T08:00:00Z'),
        completedAt: new Date('2025-06-01T16:00:00Z'),
      },
    }),
    // María worked OP-001 (Stitching)
    prisma.operatorAssignment.create({
      data: {
        operatorId: maria.id,
        productionLotId: lot001.id,
        fromStage: 'STITCHING',
        toStage: 'ASSEMBLY',
        processedPairs: 15,
        assignedAt: new Date('2025-06-02T08:00:00Z'),
        completedAt: new Date('2025-06-02T18:00:00Z'),
      },
    }),
    // Santiago working OP-002 (Assembly - in progress)
    prisma.operatorAssignment.create({
      data: {
        operatorId: santiago.id,
        productionLotId: lot002.id,
        fromStage: 'ASSEMBLY',
        toStage: null,
        processedPairs: 8,
        assignedAt: new Date('2025-06-07T08:00:00Z'),
        completedAt: null,
      },
    }),
    // María working OP-003 (Stitching - in progress)
    prisma.operatorAssignment.create({
      data: {
        operatorId: maria.id,
        productionLotId: lot003.id,
        fromStage: 'STITCHING',
        toStage: null,
        processedPairs: 5,
        assignedAt: new Date('2025-06-09T08:00:00Z'),
        completedAt: null,
      },
    }),
  ]);
  console.log(`  ✓ Created ${assignments.length} operator assignments`);

  // ---- Payroll Calculations --------------------------------------
  console.log('  Creating payroll calculations...');

  // Carlos: 15 pairs at CUTTING rate 2.00 = 30.00
  const payrollCarlos = await prisma.payrollCalculation.create({
    data: {
      operatorId: carlos.id,
      periodLabel: 'Week 1 - June 2025',
      periodStart: new Date('2025-06-01'),
      periodEnd: new Date('2025-06-07'),
      processedPairs: 15,
      ratePerPair: 2.00,
      bonus: 5.00,
      penalty: 0,
      expectedPayment: 35.00, // 15*2.00 + 5.00 bonus
      paidAmount: 20.00,
      pendingBalance: 15.00,
      commitmentHash: null,
      periodHash: null,
      proofStatus: 'NOT_GENERATED',
      verificationMode: 'ZK_OFFCHAIN',
      verificationStatus: null,
    },
  });

  // María: 20 pairs (15+5) at STITCHING rate 6.00 = 120.00
  const payrollMaria = await prisma.payrollCalculation.create({
    data: {
      operatorId: maria.id,
      periodLabel: 'Week 1 - June 2025',
      periodStart: new Date('2025-06-01'),
      periodEnd: new Date('2025-06-07'),
      processedPairs: 20,
      ratePerPair: 6.00,
      bonus: 0,
      penalty: 0,
      expectedPayment: 120.00,
      paidAmount: 120.00,
      pendingBalance: 0,
      commitmentHash: null,
      periodHash: null,
      proofStatus: 'NOT_GENERATED',
      verificationMode: 'ZK_OFFCHAIN',
      verificationStatus: null,
      stellarTxHash: null,
      verifiedAt: null,
    },
  });

  // Santiago: 8 pairs at ASSEMBLY rate 3.00 = 24.00 (not yet paid)
  const payrollSantiago = await prisma.payrollCalculation.create({
    data: {
      operatorId: santiago.id,
      periodLabel: 'Week 1 - June 2025',
      periodStart: new Date('2025-06-01'),
      periodEnd: new Date('2025-06-07'),
      processedPairs: 8,
      ratePerPair: 3.00,
      bonus: 0,
      penalty: 0,
      expectedPayment: 24.00,
      paidAmount: 0,
      pendingBalance: 24.00,
      commitmentHash: null,
      periodHash: null,
      proofStatus: 'NOT_GENERATED',
      verificationMode: 'ZK_OFFCHAIN',
      verificationStatus: null,
    },
  });
  console.log('  ✓ Created payroll calculations');

  // ---- Payments --------------------------------------------------
  console.log('  Creating payments...');
  await Promise.all([
    prisma.payment.create({
      data: {
        operatorId: carlos.id,
        payrollCalculationId: payrollCarlos.id,
        amount: 20.00,
        method: 'CASH',
        reference: 'PAY-001',
        notes: 'Partial payment - Week 1',
        paidAt: new Date('2025-06-07T17:00:00Z'),
      },
    }),
    prisma.payment.create({
      data: {
        operatorId: maria.id,
        payrollCalculationId: payrollMaria.id,
        amount: 120.00,
        method: 'TRANSFER',
        reference: 'TRF-2025-001',
        notes: 'Full payment - Week 1',
        paidAt: new Date('2025-06-07T17:30:00Z'),
      },
    }),
  ]);
  console.log('  ✓ Created payments');
  console.log('  Skipping pre-generated ZK proofs');

  // ---- Audit Events ----------------------------------------------
  console.log('  Creating audit events...');
  await Promise.all([
    prisma.auditEvent.create({
      data: {
        eventType: 'LOT_CREATED',
        entityType: 'ProductionLot',
        entityId: lot001.id,
        productionLotId: lot001.id,
        metadata: JSON.stringify({ lotCode: 'OP-001', model: 'Urbano Neo', totalPairs: 15 }),
      },
    }),
    prisma.auditEvent.create({
      data: {
        eventType: 'OPERATOR_ASSIGNED',
        entityType: 'OperatorAssignment',
        entityId: assignments[0].id,
        operatorId: carlos.id,
        productionLotId: lot001.id,
        metadata: JSON.stringify({ stage: 'CUTTING', pairs: 15 }),
      },
    }),
    prisma.auditEvent.create({
      data: {
        eventType: 'LOT_ADVANCED',
        entityType: 'ProductionLot',
        entityId: lot001.id,
        operatorId: carlos.id,
        productionLotId: lot001.id,
        metadata: JSON.stringify({ from: 'CUTTING', to: 'STITCHING', pairs: 15 }),
      },
    }),
    prisma.auditEvent.create({
      data: {
        eventType: 'PAYROLL_CALCULATED',
        entityType: 'PayrollCalculation',
        entityId: payrollMaria.id,
        operatorId: maria.id,
        metadata: JSON.stringify({ pairs: 20, rate: 6.00, amount: 120.00 }),
      },
    }),
    prisma.auditEvent.create({
      data: {
        eventType: 'PAYMENT_REGISTERED',
        entityType: 'Payment',
        entityId: payrollCarlos.id,
        operatorId: carlos.id,
        metadata: JSON.stringify({ amount: 20.00, method: 'CASH', reference: 'PAY-001' }),
      },
    }),
  ]);
  console.log('  ✓ Created audit events');

  console.log('\n✅ Database seeded successfully!');
  console.log(`   Operators: ${operators.length}`);
  console.log(`   Stage Rates: ${rates.length}`);
  console.log(`   Production Lots: ${lots.length}`);
  console.log(`   Operator Assignments: ${assignments.length}`);
  console.log('   Payroll Calculations: 3');
  console.log('   Payments: 2');
  console.log('   ZK Verifications: 0');
  console.log('   Audit Events: 5');
}

main()
  .catch(e => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
