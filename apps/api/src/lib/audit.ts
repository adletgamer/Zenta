import { prisma } from './prisma';

export type AuditEventType =
  | 'LOT_CREATED' | 'LOT_ADVANCED' | 'LOT_COMPLETED'
  | 'OPERATOR_ASSIGNED' | 'PAYROLL_CALCULATED' | 'PAYMENT_REGISTERED'
  | 'COMMITMENT_GENERATED' | 'PROOF_GENERATED' | 'PROOF_VERIFIED'
  | 'STELLAR_SUBMITTED' | 'STELLAR_SUBMISSION_STARTED' | 'STELLAR_SUBMISSION_FINISHED'
  | 'STELLAR_SUBMISSION_FAILED' | 'RATE_UPDATED';

interface CreateAuditEventParams {
  eventType: AuditEventType;
  entityType: string;
  entityId: string;
  operatorId?: string;
  productionLotId?: string;
  commitmentHash?: string;
  metadata?: Record<string, unknown>;
}

export async function createAuditEvent(params: CreateAuditEventParams) {
  return prisma.auditEvent.create({
    data: {
      eventType: params.eventType,
      entityType: params.entityType,
      entityId: params.entityId,
      operatorId: params.operatorId,
      productionLotId: params.productionLotId,
      commitmentHash: params.commitmentHash,
      metadata: JSON.stringify(params.metadata || {}),
    },
  });
}
