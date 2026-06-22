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

  const proof = input.proofData as { _simulation?: boolean; pi_a?: unknown; pi_b?: unknown; pi_c?: unknown };
  const hasSimulationMarker = proof._simulation === true;
  const hasGroth16Proof = Boolean(proof.pi_a && proof.pi_b && proof.pi_c);
  const signalsMatch =
    input.publicSignals.includes(input.commitmentHash) ||
    input.publicSignals[0] === input.commitmentHash;

  const success = (hasSimulationMarker || hasGroth16Proof) && signalsMatch;
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
    error: success ? undefined : 'Proof data did not match the public commitment signal',
  };
}

export const stellarService = { verifyPayroll };
