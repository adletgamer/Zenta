import { api, ApiResponse } from './client';

export interface StageRate {
  id: string;
  stage: string;
  ratePerPair: number;
  active: boolean;
  version: number;
  validFrom: string;
  updatedAt: string;
}

export interface RateHistoryItem {
  id: string;
  timestamp: string;
  metadata: {
    stage?: string;
    newRate?: number;
    version?: number;
  };
}

export const ratesApi = {
  list: () => api.get<ApiResponse<StageRate[]>>('/api/rates'),
  history: () => api.get<ApiResponse<RateHistoryItem[]>>('/api/rates/history'),
  update: (stage: string, ratePerPair: number) =>
    api.put<ApiResponse<StageRate>>(`/api/rates/${stage}`, { ratePerPair }),
};
