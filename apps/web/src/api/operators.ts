import { api, ApiResponse } from './client';

export interface Operator {
  id: string;
  pseudonymousCode: string;
  displayName: string;
  specialization: string;
  active: boolean;
  totalProcessedPairs: number;
  totalTasksCompleted: number;
  activeAssignments: number;
  totalEarned: number;
  totalPaid: number;
  pendingBalance: number;
  createdAt: string;
}

export const operatorsApi = {
  list: () => api.get<ApiResponse<Operator[]>>('/api/operators'),
  get: (id: string) => api.get<ApiResponse<Operator>>(`/api/operators/${id}`),
  create: (data: { displayName: string; specialization: string }) =>
    api.post<ApiResponse<Operator>>('/api/operators', data),
  assignLot: (id: string, body: { productionLotId: string; processedPairs: number }) =>
    api.post<ApiResponse<unknown>>(`/api/operators/${id}/assign-lot`, body),
};
