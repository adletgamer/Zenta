import { api, ApiResponse } from './client';

export interface StellarAdminStatus {
  configured: boolean;
  health: 'READY' | 'MISSING_CONFIGURATION' | string;
  publicKey: string | null;
  network: string;
  rpcUrl: string;
  horizonUrl: string;
  contractId: string;
  verificationMode: string;
  balance: string | null;
  latestTxHash: string | null;
  latestLedger: number | null;
  latestStatus: string | null;
  eventConfirmed: boolean;
  stateConfirmed: boolean;
  confirmationSource: 'event' | 'contract_state' | 'none' | 'simulated' | string;
  commitmentHash: string | null;
  periodHash: string | null;
  latestSubmittedAt: string | null;
  latestVerifiedAt: string | null;
}

export const stellarApi = {
  adminStatus: () => api.get<ApiResponse<StellarAdminStatus>>('/api/stellar/admin-status'),
};
