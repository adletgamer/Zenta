import { api, ApiResponse } from './client';

export interface ZkVerification {
  id: string;
  payrollCalculationId: string;
  commitmentHash: string;
  periodHash: string;
  proofStatus: string;
  proofData: string | null;
  publicSignals: string | null;
  verificationMode: string;
  stellarTxHash: string | null;
  stellarContractId: string | null;
  verifiedAt: string | null;
  createdAt: string;
  payrollCalculation?: {
    periodLabel: string;
    expectedPayment: number;
    operator: { displayName: string; specialization: string };
  };
}

export const zkApi = {
  list: () => api.get<ApiResponse<ZkVerification[]>>('/api/zk/verifications'),
  generateCommitment: (payrollCalculationId: string) =>
    api.post<ApiResponse<unknown>>('/api/zk/generate-commitment', { payrollCalculationId }),
  generateProof: (payrollCalculationId: string) =>
    api.post<ApiResponse<unknown>>('/api/zk/generate-proof', { payrollCalculationId }),
  verifyOnStellar: (payrollCalculationId: string) =>
    api.post<ApiResponse<unknown>>('/api/zk/verify-on-stellar', { payrollCalculationId }),
};
