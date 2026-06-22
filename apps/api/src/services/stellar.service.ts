import crypto from 'crypto';

export interface StellarVerifyInput {
  commitmentHash: string;
  periodHash: string;
  proofData: Record<string, unknown>;
  publicSignals: string[];
  verificationMode: string;
}

export interface StellarVerifyResult {
  success: boolean;
  txHash: string;
  contractId: string;
  status: 'SIMULATED_VERIFIED' | 'SIMULATED_REJECTED';
  verificationMode: 'SIMULATED';
  ledger: number;
  error?: string;
}

async function verifyPayroll(input: StellarVerifyInput): Promise<StellarVerifyResult> {
  return simulateVerification(input);
}

function simulateVerification(input: StellarVerifyInput): StellarVerifyResult {
  console.log('[STELLAR][SIMULATED] Recording simulated on-chain payroll verification');

  const hasSimulationMarker = (input.proofData as { _simulation?: boolean })._simulation === true;
  const signalsMatch =
    input.publicSignals.includes(input.commitmentHash) &&
    input.publicSignals.includes(input.periodHash);

  const success = hasSimulationMarker && signalsMatch;
  const txHash = '0x' + crypto
    .createHash('sha256')
    .update(`stellar-sim:${input.commitmentHash}:${Date.now()}`)
    .digest('hex');

  return {
    success,
    txHash,
    contractId: `SIMULATED_ZENTA_VERIFIER_${input.commitmentHash.substring(2, 10).toUpperCase()}`,
    status: success ? 'SIMULATED_VERIFIED' : 'SIMULATED_REJECTED',
    verificationMode: 'SIMULATED',
    ledger: Math.floor(Math.random() * 1000000) + 50000000,
    error: success ? undefined : 'Simulated proof envelope did not match public signals',
  };
}

export const stellarService = { verifyPayroll };
