import { api, ApiResponse } from './client';

export interface PayrollSummary {
  totalOperators: number;
  totalPairs: number;
  totalEarned: number;
  totalPaid: number;
  totalPending: number;
  verifiedPayrolls: number;
  periodLabel: string;
}

export interface PayrollCalc {
  id: string;
  operatorId: string;
  periodLabel: string;
  processedPairs: number;
  ratePerPair: number;
  bonus: number;
  penalty: number;
  expectedPayment: number;
  paidAmount: number;
  pendingBalance: number;
  proofStatus: string;
  verificationMode: string;
  stellarTxHash: string | null;
  verifiedAt: string | null;
  commitmentHash: string | null;
  periodHash: string | null;
  createdAt: string;
  operator?: { displayName: string; specialization: string };
}

export const payrollApi = {
  summary: () => api.get<ApiResponse<PayrollSummary>>('/api/payroll/summary'),
  operators: () => api.get<ApiResponse<PayrollCalc[]>>('/api/payroll/operators'),
  calculate: (data: {
    operatorId: string;
    periodLabel: string;
    periodStart: string;
    periodEnd: string;
    bonus?: number;
    penalty?: number;
  }) => api.post<ApiResponse<PayrollCalc>>('/api/payroll/calculate', data),
  registerPayment: (data: {
    operatorId: string;
    payrollCalculationId?: string;
    amount: number;
    method: string;
    reference?: string;
    notes?: string;
  }) => api.post<ApiResponse<unknown>>('/api/payroll/payments', data),
};
