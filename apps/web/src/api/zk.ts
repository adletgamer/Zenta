import { api, ApiResponse } from './client';

export interface ZkVerification {
  id: string;
  zkProofId: string;
  payrollCalculationId: string;
  commitmentHash: string;
  commitmentField: string | null;
  periodHash: string;
  proofStatus: string;
  proofData: string | null;
  publicSignals: string | null;
  verificationMode: string;
  stellarTxHash: string | null;
  stellarContractId: string | null;
  ledger: number | null;
  eventConfirmed: boolean;
  stateConfirmed?: boolean;
  confirmationSource?: string;
  verifiedAt: string | null;
  generatedAt: string | null;
  verifiedOffchainAt: string | null;
  createdAt: string;
  proofSystem: string;
  circuit: string;
  commitmentScheme: string;
  circuitVersion?: {
    name: string;
    version: string;
    provingKeyPath: string | null;
    verifyingKeyPath: string | null;
  } | null;
  payrollCalculation?: {
    periodLabel: string;
    expectedPayment: number;
    processedPairs?: number;
    operator: { displayName: string; specialization: string };
    zkCommitment?: {
      hashAlgorithm: string;
      poseidonInputDigest: string;
      mode: string;
    } | null;
  };
}

export interface ZkSummary {
  pendingPayrolls: number;
  generatedProofs: number;
  verifiedOnchain: number;
  latestCommitmentHash: string | null;
  mode: string;
}

export interface ZkQueueItem {
  id: string;
  periodLabel: string;
  processedPairs: number;
  ratePerPair: number;
  expectedPayment: number;
  pendingBalance: number;
  proofStatus: string;
  commitmentHash: string | null;
  periodHash: string | null;
  stellarTxHash: string | null;
  verifiedAt: string | null;
  operator?: { displayName: string; specialization: string };
  zkCommitment?: {
    hashAlgorithm: string;
    poseidonInputDigest: string;
    mode: string;
  } | null;
}

export const zkApi = {
  summary: () => api.get<ApiResponse<ZkSummary>>('/api/zk/summary'),
  queue: () => api.get<ApiResponse<ZkQueueItem[]>>('/api/zk/queue'),
  list: () => api.get<ApiResponse<ZkVerification[]>>('/api/zk/verifications'),
  generateCommitment: (payrollCalculationId: string) =>
    api.post<ApiResponse<unknown>>('/api/zk/generate-commitment', { payrollCalculationId }),
  generateProof: (payrollCalculationId: string) =>
    api.post<ApiResponse<unknown>>('/api/zk/generate-proof', { payrollCalculationId }),
  verifyOffchain: (payrollCalculationId: string) =>
    api.post<ApiResponse<unknown>>('/api/zk/verify-offchain', { payrollCalculationId }),
  verifyOffchainProof: (zkProofId: string) =>
    api.post<ApiResponse<unknown>>('/api/zk/verify-offchain', { zkProofId }),
  verifyOnStellar: (payrollCalculationId: string) =>
    api.post<ApiResponse<unknown>>('/api/zk/verify-on-stellar', { payrollCalculationId }),
  verifyProofOnStellar: (zkProofId: string) =>
    api.post<ApiResponse<unknown>>('/api/zk/verify-on-stellar', { zkProofId }),
};
