-- CreateTable
CREATE TABLE "operators" (
    "id" TEXT NOT NULL,
    "pseudonymousCode" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "specialization" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_rates" (
    "id" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "ratePerPair" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stage_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_lots" (
    "id" TEXT NOT NULL,
    "lotCode" TEXT NOT NULL,
    "plannedDate" TIMESTAMP(3) NOT NULL,
    "model" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "sizeCurve" TEXT NOT NULL DEFAULT 'Standard',
    "totalPairs" INTEGER NOT NULL,
    "currentStage" TEXT NOT NULL DEFAULT 'QUEUE',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "estimatedMaterial" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estimatedLaborHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operator_assignments" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "productionLotId" TEXT NOT NULL,
    "fromStage" TEXT NOT NULL,
    "toStage" TEXT,
    "processedPairs" INTEGER NOT NULL DEFAULT 0,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "operator_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_calculations" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "processedPairs" INTEGER NOT NULL,
    "ratePerPair" DOUBLE PRECISION NOT NULL,
    "bonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "penalty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedPayment" DOUBLE PRECISION NOT NULL,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pendingBalance" DOUBLE PRECISION NOT NULL,
    "commitmentHash" TEXT,
    "periodHash" TEXT,
    "proofStatus" TEXT NOT NULL DEFAULT 'NOT_GENERATED',
    "verificationStatus" TEXT,
    "verificationMode" TEXT NOT NULL DEFAULT 'SIMULATED',
    "stellarTxHash" TEXT,
    "stellarContractId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_calculations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "payrollCalculationId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "operatorId" TEXT,
    "productionLotId" TEXT,
    "commitmentHash" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zk_verifications" (
    "id" TEXT NOT NULL,
    "payrollCalculationId" TEXT NOT NULL,
    "commitmentHash" TEXT NOT NULL,
    "periodHash" TEXT NOT NULL,
    "proofStatus" TEXT NOT NULL DEFAULT 'NOT_GENERATED',
    "proofData" TEXT,
    "publicSignals" TEXT,
    "verificationMode" TEXT NOT NULL DEFAULT 'SIMULATED',
    "stellarTxHash" TEXT,
    "stellarContractId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zk_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zk_commitments" (
    "id" TEXT NOT NULL,
    "payrollCalculationId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "commitmentHash" TEXT NOT NULL,
    "periodHash" TEXT NOT NULL,
    "poseidonInputDigest" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "hashAlgorithm" TEXT NOT NULL DEFAULT 'POSEIDON_SIMULATED',
    "mode" TEXT NOT NULL DEFAULT 'SIMULATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zk_commitments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stellar_submissions" (
    "id" TEXT NOT NULL,
    "zkCommitmentId" TEXT NOT NULL,
    "payrollCalculationId" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'SIMULATED',
    "ledger" INTEGER,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stellar_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "operators_pseudonymousCode_key" ON "operators"("pseudonymousCode");

-- CreateIndex
CREATE UNIQUE INDEX "stage_rates_stage_key" ON "stage_rates"("stage");

-- CreateIndex
CREATE UNIQUE INDEX "production_lots_lotCode_key" ON "production_lots"("lotCode");

-- CreateIndex
CREATE UNIQUE INDEX "zk_verifications_payrollCalculationId_key" ON "zk_verifications"("payrollCalculationId");

-- CreateIndex
CREATE UNIQUE INDEX "zk_verifications_commitmentHash_key" ON "zk_verifications"("commitmentHash");

-- CreateIndex
CREATE UNIQUE INDEX "zk_commitments_payrollCalculationId_key" ON "zk_commitments"("payrollCalculationId");

-- CreateIndex
CREATE UNIQUE INDEX "zk_commitments_commitmentHash_key" ON "zk_commitments"("commitmentHash");

-- AddForeignKey
ALTER TABLE "operator_assignments" ADD CONSTRAINT "operator_assignments_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operator_assignments" ADD CONSTRAINT "operator_assignments_productionLotId_fkey" FOREIGN KEY ("productionLotId") REFERENCES "production_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_calculations" ADD CONSTRAINT "payroll_calculations_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_payrollCalculationId_fkey" FOREIGN KEY ("payrollCalculationId") REFERENCES "payroll_calculations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_productionLotId_fkey" FOREIGN KEY ("productionLotId") REFERENCES "production_lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zk_verifications" ADD CONSTRAINT "zk_verifications_payrollCalculationId_fkey" FOREIGN KEY ("payrollCalculationId") REFERENCES "payroll_calculations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zk_commitments" ADD CONSTRAINT "zk_commitments_payrollCalculationId_fkey" FOREIGN KEY ("payrollCalculationId") REFERENCES "payroll_calculations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zk_commitments" ADD CONSTRAINT "zk_commitments_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stellar_submissions" ADD CONSTRAINT "stellar_submissions_zkCommitmentId_fkey" FOREIGN KEY ("zkCommitmentId") REFERENCES "zk_commitments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
