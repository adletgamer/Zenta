import { api, ApiResponse } from './client';

export interface Lot {
  id: string;
  lotCode: string;
  plannedDate: string;
  model: string;
  color: string;
  priority: string;
  sizeCurve: string;
  totalPairs: number;
  currentStage: string;
  status: string;
  estimatedMaterial: number;
  estimatedLaborHours: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  assignments?: Array<{ id: string; operator: { displayName: string }; processedPairs: number }>;
}

export const lotsApi = {
  list: () => api.get<ApiResponse<Lot[]>>('/api/lots'),
  get: (id: string) => api.get<ApiResponse<Lot>>(`/api/lots/${id}`),
  create: (data: Partial<Lot>) => api.post<ApiResponse<Lot>>('/api/lots', data),
  advance: (id: string, body: { processedPairs: number; operatorId?: string; notes?: string }) =>
    api.patch<ApiResponse<Lot>>(`/api/lots/${id}/advance`, body),
  cancel: (id: string) => api.delete<ApiResponse<{ message: string }>>(`/api/lots/${id}`),
};
