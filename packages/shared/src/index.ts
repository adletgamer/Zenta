// ============================================================
// Zenta Shared Types
// Shared between frontend (apps/web) and backend (apps/api)
// ============================================================

// ---- Enums --------------------------------------------------

export type ProductionStage =
  | 'QUEUE'
  | 'CUTTING'
  | 'STITCHING'
  | 'ASSEMBLY'
  | 'SOLE_ATTACHMENT'
  | 'FINISHING'
  | 'COMPLETED';

export type LotStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

export type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type Specialization =
  | 'CUTTING'
  | 'STITCHING'
  | 'ASSEMBLY'
  | 'SOLE_ATTACHMENT'
  | 'FINISHING';

export type PaymentMethod = 'CASH' | 'TRANSFER' | 'VOUCHER';

export type ProofStatus =
  | 'NOT_GENERATED'
  | 'GENERATING'
  | 'GENERATED'
  | 'VERIFYING'
  | 'VERIFIED'
  | 'FAILED';

export type VerificationMode = 'SIMULATED' | 'STELLAR_REGISTRY_TESTNET' | 'STELLAR_ZK_TESTNET';

export type AuditEventType =
  | 'LOT_CREATED'
  | 'LOT_ADVANCED'
  | 'LOT_COMPLETED'
  | 'OPERATOR_ASSIGNED'
  | 'PAYROLL_CALCULATED'
  | 'PAYMENT_REGISTERED'
  | 'COMMITMENT_GENERATED'
  | 'PROOF_GENERATED'
  | 'PROOF_VERIFIED'
  | 'STELLAR_SUBMITTED'
  | 'RATE_UPDATED';

// ---- Operator -----------------------------------------------

export interface Operator {
  id: string;
  pseudonymousCode: string;
  displayName: string;
  specialization: Specialization;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OperatorWithStats extends Operator {
  totalProcessedPairs: number;
  totalTasksCompleted: number;
  activeAssignments: number;
  totalEarned: number;
  totalPaid: number;
  pendingBalance: number;
}

// ---- Stage Rate ---------------------------------------------

export interface StageRate {
  id: string;
  stage: ProductionStage;
  ratePerPair: number;
  active: boolean;
  version: number;
  validFrom: string;
  validTo: string | null;
  updatedAt: string;
}

// ---- Production Lot -----------------------------------------

export interface ProductionLot {
  id: string;
  lotCode: string;
  plannedDate: string;
  model: string;
  color: string;
  priority: Priority;
  sizeCurve: string;
  totalPairs: number;
  currentStage: ProductionStage;
  status: LotStatus;
  estimatedMaterial: number;
  estimatedLaborHours: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductionLotWithAssignments extends ProductionLot {
  assignments: OperatorAssignment[];
}

// ---- Operator Assignment ------------------------------------

export interface OperatorAssignment {
  id: string;
  operatorId: string;
  productionLotId: string;
  fromStage: ProductionStage;
  toStage: ProductionStage | null;
  processedPairs: number;
  assignedAt: string;
  completedAt: string | null;
  operator?: Operator;
  productionLot?: ProductionLot;
}

// ---- Payroll ------------------------------------------------

export interface PayrollCalculation {
  id: string;
  operatorId: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  processedPairs: number;
  ratePerPair: number;
  bonus: number;
  penalty: number;
  expectedPayment: number;
  paidAmount: number;
  pendingBalance: number;
  commitmentHash: string | null;
  periodHash: string | null;
  proofStatus: ProofStatus;
  verificationStatus: string | null;
  verificationMode: VerificationMode;
  stellarTxHash: string | null;
  stellarContractId: string | null;
  verifiedAt: string | null;
  createdAt: string;
  operator?: Operator;
}

export interface PayrollSummary {
  totalOperators: number;
  totalPairs: number;
  totalEarned: number;
  totalPaid: number;
  totalPending: number;
  periodLabel: string;
  verifiedPayrolls: number;
}

// ---- Payment ------------------------------------------------

export interface Payment {
  id: string;
  operatorId: string;
  payrollCalculationId: string | null;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  paidAt: string;
  operator?: Operator;
}

// ---- Audit Event -------------------------------------------

export interface AuditEvent {
  id: string;
  eventType: AuditEventType;
  entityType: string;
  entityId: string;
  operatorId: string | null;
  productionLotId: string | null;
  commitmentHash: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  operator?: Operator;
  productionLot?: ProductionLot;
}

// ---- ZK Verification ----------------------------------------

export interface ZkVerification {
  id: string;
  payrollCalculationId: string;
  commitmentHash: string;
  periodHash: string;
  proofStatus: ProofStatus;
  proofData: string | null;       // JSON-encoded Groth16 proof
  publicSignals: string | null;   // JSON-encoded public signals
  verificationMode: VerificationMode;
  stellarTxHash: string | null;
  stellarContractId: string | null;
  verifiedAt: string | null;
  createdAt: string;
  payrollCalculation?: PayrollCalculation;
}

// ---- API Request/Response Types ----------------------------

export interface CreateLotRequest {
  lotCode: string;
  plannedDate: string;
  model: string;
  color: string;
  priority: Priority;
  sizeCurve: string;
  totalPairs: number;
  estimatedMaterial: number;
  estimatedLaborHours: number;
  notes?: string;
}

export interface AdvanceLotRequest {
  processedPairs: number;
  operatorId?: string;
  notes?: string;
}

export interface CreateOperatorRequest {
  displayName: string;
  specialization: Specialization;
}

export interface AssignLotRequest {
  productionLotId: string;
  processedPairs: number;
}

export interface UpdateRateRequest {
  ratePerPair: number;
}

export interface CalculatePayrollRequest {
  operatorId: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  bonus?: number;
  penalty?: number;
}

export interface RegisterPaymentRequest {
  operatorId: string;
  payrollCalculationId?: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
}

export interface GenerateCommitmentRequest {
  payrollCalculationId: string;
}

export interface GenerateProofRequest {
  payrollCalculationId: string;
}

export interface VerifyOnStellarRequest {
  payrollCalculationId: string;
}

// ---- API Response Wrapper ----------------------------------

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ---- Stage Display Helpers ----------------------------------

export const STAGE_DISPLAY_NAMES: Record<ProductionStage, string> = {
  QUEUE: 'Queue',
  CUTTING: 'Cutting',
  STITCHING: 'Stitching',
  ASSEMBLY: 'Assembly',
  SOLE_ATTACHMENT: 'Sole Attachment',
  FINISHING: 'Finishing',
  COMPLETED: 'Completed',
};

export const STAGE_ORDER: ProductionStage[] = [
  'QUEUE',
  'CUTTING',
  'STITCHING',
  'ASSEMBLY',
  'SOLE_ATTACHMENT',
  'FINISHING',
  'COMPLETED',
];

export const SPECIALIZATION_TO_STAGE: Record<Specialization, ProductionStage> = {
  CUTTING: 'CUTTING',
  STITCHING: 'STITCHING',
  ASSEMBLY: 'ASSEMBLY',
  SOLE_ATTACHMENT: 'SOLE_ATTACHMENT',
  FINISHING: 'FINISHING',
};

export const DEFAULT_RATES: Record<Specialization, number> = {
  CUTTING: 2.00,
  STITCHING: 6.00,
  ASSEMBLY: 3.00,
  SOLE_ATTACHMENT: 3.00,
  FINISHING: 1.50,
};
