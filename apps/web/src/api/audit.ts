import { api, ApiResponse } from './client';

export interface AuditEvent {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  operatorId: string | null;
  productionLotId: string | null;
  commitmentHash: string | null;
  proofStatus: string | null;
  verificationStatus: string | null;
  timestamp: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  operator?: { displayName: string };
  productionLot?: { lotCode: string };
}

export const auditApi = {
  list: (limit = 50, offset = 0) =>
    api.get<ApiResponse<AuditEvent[]> & { total: number }>(`/api/audit?limit=${limit}&offset=${offset}`),
  get: (id: string) => api.get<ApiResponse<AuditEvent>>(`/api/audit/${id}`),
};
