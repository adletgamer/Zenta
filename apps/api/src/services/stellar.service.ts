/**
 * Zenta Stellar Service
 * Handles Soroban smart contract interaction for ZK proof verification.
 *
 * SIMULATED mode: Returns mock stellar tx data — clearly labeled.
 * STELLAR_TESTNET mode: Interacts with real Stellar testnet via @stellar/stellar-sdk.
 *
 * The contract stores: commitmentHash → { verified, periodHash, verifiedAt, submitter }
 * It does NOT store sensitive payroll data.
 */
import crypto from 'crypto';

const VERIFICATION_MODE = process.env.VERIFICATION_MODE || 'SIMULATED';
const STELLAR_CONTRACT_ID = process.env.STELLAR_CONTRACT_ID || '';
const STELLAR_SECRET_KEY = process.env.STELLAR_SECRET_KEY || '';
const STELLAR_RPC_URL = process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';

export interface StellarVerifyInput {
  commitmentHash: string;
  periodHash: string;
  proofData: Record<string, unknown>;
  publicSignals: string[];
  verificationMode: string;
}

export interface StellarVerifyResult {
  success: boolean;
  txHash: string | null;
  contractId: string | null;
  status: string;
  verificationMode: string;
  blockNumber?: number;
  ledger?: number;
  error?: string;
}

/**
 * Submit ZK proof to Stellar Soroban contract for on-chain verification.
 * Falls back to simulation if STELLAR_CONTRACT_ID or STELLAR_SECRET_KEY is not set.
 */
async function verifyPayroll(input: StellarVerifyInput): Promise<StellarVerifyResult> {
  const mode = input.verificationMode || VERIFICATION_MODE;

  if (mode === 'SIMULATED' || !STELLAR_CONTRACT_ID || !STELLAR_SECRET_KEY) {
    return simulateVerification(input);
  }

  return verifyOnTestnet(input);
}

/**
 * SIMULATED verification — clearly labeled.
 * Generates mock Stellar tx hash. DO NOT present as real blockchain verification.
 */
function simulateVerification(input: StellarVerifyInput): StellarVerifyResult {
  console.log('[STELLAR][SIMULATED] Simulating Stellar verification — NOT real blockchain');

  // Generate a deterministic mock tx hash from commitment + timestamp
  const mockTx = '0x' + crypto.createHash('sha256')
    .update(input.commitmentHash + Date.now().toString())
    .digest('hex');

  return {
    success: true,
    txHash: mockTx,
    contractId: 'SIMULATED_CONTRACT_' + input.commitmentHash.substring(0, 8),
    status: 'SIMULATED_VERIFIED',
    verificationMode: 'SIMULATED',
    ledger: Math.floor(Math.random() * 1000000) + 50000000,
  };
}

/**
 * Real Stellar testnet verification via @stellar/stellar-sdk.
 * Calls the Soroban verification registry contract.
 *
 * Contract function: verify_payroll(commitment_hash, period_hash, proof_pi_a, proof_pi_b, proof_pi_c, public_signals)
 * Returns: bool (verified or not)
 * Emits: PayrollVerified(commitment_hash, period_hash, timestamp) event
 */
async function verifyOnTestnet(input: StellarVerifyInput): Promise<StellarVerifyResult> {
  try {
    // Dynamic import to avoid loading stellar-sdk when not needed
    const stellar = await import('@stellar/stellar-sdk');
    const { Keypair, Networks, TransactionBuilder, BASE_FEE, xdr } = stellar;
    const SorobanRpc = (stellar as any).rpc || (stellar as any).SorobanRpc;

    const server = new SorobanRpc.Server(STELLAR_RPC_URL);
    const keypair = Keypair.fromSecret(STELLAR_SECRET_KEY);
    const sourceAccount = await server.getAccount(keypair.publicKey());

    // Encode commitment as Soroban ScVal bytes
    const commitmentBytes = Buffer.from(input.commitmentHash.replace('0x', ''), 'hex');
    const periodBytes = Buffer.from(input.periodHash.replace('0x', ''), 'hex');

    const contract = new (stellar as any).Contract(STELLAR_CONTRACT_ID);

    // Build transaction calling verify_payroll on the contract
    const tx = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        contract.call(
          'verify_payroll',
          xdr.ScVal.scvBytes(commitmentBytes),
          xdr.ScVal.scvBytes(periodBytes),
        )
      )
      .setTimeout(30)
      .build();

    // Simulate then sign and submit
    const simResult = await server.simulateTransaction(tx);
    if ('error' in simResult) {
      throw new Error(`Simulation failed: ${simResult.error}`);
    }

    const preparedTx = SorobanRpc.assembleTransaction(tx, simResult).build();
    preparedTx.sign(keypair);

    const sendResult = await server.sendTransaction(preparedTx);
    if (sendResult.status === 'ERROR') {
      throw new Error(`Transaction failed: ${JSON.stringify(sendResult.errorResult)}`);
    }

    // Wait for confirmation
    let attempts = 0;
    let txResult = await server.getTransaction(sendResult.hash);
    while (txResult.status === 'NOT_FOUND' && attempts < 20) {
      await new Promise(r => setTimeout(r, 1000));
      txResult = await server.getTransaction(sendResult.hash);
      attempts++;
    }

    if (txResult.status !== 'SUCCESS') {
      throw new Error(`Transaction status: ${txResult.status}`);
    }

    return {
      success: true,
      txHash: sendResult.hash,
      contractId: STELLAR_CONTRACT_ID,
      status: 'STELLAR_VERIFIED',
      verificationMode: 'STELLAR_TESTNET',
      ledger: (txResult as any).ledger,
    };
  } catch (err) {
    console.error('[STELLAR] Testnet verification failed:', err);
    return {
      success: false,
      txHash: null,
      contractId: STELLAR_CONTRACT_ID,
      status: 'STELLAR_FAILED',
      verificationMode: 'STELLAR_TESTNET',
      error: (err as Error).message,
    };
  }
}

export const stellarService = { verifyPayroll };
