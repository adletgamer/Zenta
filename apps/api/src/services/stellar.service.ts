import crypto from 'crypto';

const STELLAR_CONTRACT_ID = process.env.STELLAR_CONTRACT_ID || '';
const STELLAR_SECRET_KEY = process.env.STELLAR_SECRET_KEY || '';
const STELLAR_RPC_URL = process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';

export type VerificationMode = 'SIMULATED' | 'STELLAR_REGISTRY_TESTNET' | 'STELLAR_ZK_TESTNET';

export interface StellarVerifyInput {
  commitmentHash: string;
  periodHash: string;
  proofData: Record<string, unknown>;
  publicSignals: string[];
  verificationMode: VerificationMode | string;
}

export interface PayrollRegistryVerificationInput {
  commitmentHash: string;
  periodHash: string;
  verificationMode: VerificationMode;
}

export interface StellarVerifyResult {
  success: boolean;
  txHash: string;
  contractId: string;
  status: 'STELLAR_VERIFIED' | 'STELLAR_FAILED' | 'SIMULATED_VERIFIED' | 'SIMULATED_REJECTED';
  verificationMode: VerificationMode;
  ledger: number;
  eventConfirmed?: boolean;
  stateConfirmed?: boolean;
  confirmationSource?: ConfirmationSource;
  commitmentHash?: string;
  periodHash?: string;
  error?: string;
}

export type ConfirmationSource = 'event' | 'contract_state' | 'none' | 'simulated';

export interface StellarConfirmationResult {
  eventConfirmed: boolean;
  stateConfirmed: boolean;
  confirmationSource: ConfirmationSource;
  commitmentHash?: string;
  periodHash?: string;
  events: DecodedStellarEvent[];
}

export interface DecodedStellarEvent {
  txHash: string | null;
  ledger: number | null;
  contractId: string | null;
  topics: string[];
  data: string | null;
  matchesEventName: boolean;
  matchesCommitment: boolean;
  matchesPeriod: boolean;
}

async function verifyPayroll(input: StellarVerifyInput): Promise<StellarVerifyResult> {
  const verificationMode =
    input.verificationMode === 'SIMULATED' ? 'SIMULATED' : 'STELLAR_REGISTRY_TESTNET';

  return submitPayrollRegistryVerification({
    commitmentHash: input.commitmentHash,
    periodHash: input.periodHash,
    verificationMode,
  });
}

async function submitPayrollRegistryVerification(
  input: PayrollRegistryVerificationInput,
): Promise<StellarVerifyResult> {
  if (input.verificationMode === 'SIMULATED') {
    return simulateVerification(input);
  }

  if (input.verificationMode === 'STELLAR_ZK_TESTNET') {
    return {
      success: false,
      txHash: '',
      contractId: STELLAR_CONTRACT_ID,
      status: 'STELLAR_FAILED',
      verificationMode: 'STELLAR_ZK_TESTNET',
      ledger: 0,
      eventConfirmed: false,
      stateConfirmed: false,
      confirmationSource: 'none',
      commitmentHash: input.commitmentHash,
      periodHash: input.periodHash,
      error: 'STELLAR_ZK_TESTNET requires a deployed Soroban Groth16 verifier; current contract is a registry only.',
    };
  }

  if (!STELLAR_CONTRACT_ID || !STELLAR_SECRET_KEY) {
    return {
      success: false,
      txHash: '',
      contractId: STELLAR_CONTRACT_ID,
      status: 'STELLAR_FAILED',
      verificationMode: 'STELLAR_REGISTRY_TESTNET',
      ledger: 0,
      eventConfirmed: false,
      stateConfirmed: false,
      confirmationSource: 'none',
      commitmentHash: input.commitmentHash,
      periodHash: input.periodHash,
      error: 'Missing STELLAR_CONTRACT_ID or STELLAR_SECRET_KEY for registry submission.',
    };
  }

  return verifyOnTestnet(input);
}

function fieldToBytes32(value: string): Buffer {
  const normalized = value.startsWith('0x') ? BigInt(value) : BigInt(value);
  const hex = normalized.toString(16).padStart(64, '0');
  return Buffer.from(hex.slice(-64), 'hex');
}

function bytesFromJson(value: unknown): Buffer {
  return Buffer.from(JSON.stringify(value ?? null), 'utf8');
}

async function verifyOnTestnet(input: PayrollRegistryVerificationInput): Promise<StellarVerifyResult> {
  try {
    const stellar = await import('@stellar/stellar-sdk');
    const { BASE_FEE, Contract, Keypair, Networks, TransactionBuilder, xdr } = stellar;
    const SorobanRpc = (stellar as any).rpc || (stellar as any).SorobanRpc;

    const server = new SorobanRpc.Server(STELLAR_RPC_URL);
    const sourceKeypair = Keypair.fromSecret(STELLAR_SECRET_KEY);
    const sourceAccount = await server.getAccount(sourceKeypair.publicKey());
    const contract = new Contract(STELLAR_CONTRACT_ID);
    // V1 registry stores the commitment and emits payroll_verified. It does not
    // verify Groth16 on-chain, so opaque placeholders are sent for ignored args.
    const registryPayload = { mode: input.verificationMode, commitmentHash: input.commitmentHash };

    const tx = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        contract.call(
          'verify_and_register',
          xdr.ScVal.scvBytes(fieldToBytes32(input.commitmentHash)),
          xdr.ScVal.scvBytes(fieldToBytes32(input.periodHash)),
          xdr.ScVal.scvBytes(bytesFromJson([input.commitmentHash, input.periodHash])),
          xdr.ScVal.scvBytes(bytesFromJson(registryPayload)),
          xdr.ScVal.scvBytes(bytesFromJson(registryPayload)),
          xdr.ScVal.scvBytes(bytesFromJson(registryPayload)),
        ),
      )
      .setTimeout(60)
      .build();

    const prepared = await server.prepareTransaction(tx);
    prepared.sign(sourceKeypair);

    const sent = await server.sendTransaction(prepared);
    if (sent.status === 'ERROR') {
      throw new Error(`Stellar send failed: ${JSON.stringify(sent.errorResult)}`);
    }

    let txResult = await server.getTransaction(sent.hash);
    for (let attempt = 0; txResult.status === 'NOT_FOUND' && attempt < 30; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      txResult = await server.getTransaction(sent.hash);
    }

    if (txResult.status !== 'SUCCESS') {
      throw new Error(`Stellar transaction status: ${txResult.status}`);
    }

    const confirmation = await confirmPayrollRegistration({
      txHash: sent.hash,
      ledger: txResult.ledger,
      contractId: STELLAR_CONTRACT_ID,
      commitmentHash: input.commitmentHash,
      periodHash: input.periodHash,
    }, server);

    return {
      success: true,
      txHash: sent.hash,
      contractId: STELLAR_CONTRACT_ID,
      status: 'STELLAR_VERIFIED',
      verificationMode: 'STELLAR_REGISTRY_TESTNET',
      ledger: txResult.ledger,
      eventConfirmed: confirmation.eventConfirmed,
      stateConfirmed: confirmation.stateConfirmed,
      confirmationSource: confirmation.confirmationSource,
      commitmentHash: input.commitmentHash,
      periodHash: input.periodHash,
    };
  } catch (err) {
    return {
      success: false,
      txHash: '',
      contractId: STELLAR_CONTRACT_ID,
      status: 'STELLAR_FAILED',
      verificationMode: 'STELLAR_REGISTRY_TESTNET',
      ledger: 0,
      eventConfirmed: false,
      stateConfirmed: false,
      confirmationSource: 'none',
      commitmentHash: input.commitmentHash,
      periodHash: input.periodHash,
      error: (err as Error).message,
    };
  }
}

async function confirmPayrollRegistration(
  input: {
    txHash?: string | null;
    ledger?: number | null;
    contractId?: string | null;
    commitmentHash?: string | null;
    periodHash?: string | null;
  },
  providedServer?: any,
): Promise<StellarConfirmationResult> {
  const stellar = await import('@stellar/stellar-sdk');
  const SorobanRpc = (stellar as any).rpc || (stellar as any).SorobanRpc;
  const server = providedServer ?? new SorobanRpc.Server(STELLAR_RPC_URL);
  const contractId = input.contractId || STELLAR_CONTRACT_ID;
  const eventResult = await confirmPayrollEvent(
    server,
    contractId,
    input.ledger ?? 0,
    input.txHash ?? '',
    input.commitmentHash ?? '',
    input.periodHash ?? '',
  );
  const stateConfirmed = eventResult.eventConfirmed
    ? true
    : await confirmContractState(server, contractId, input.commitmentHash ?? '');

  const confirmationSource = eventResult.eventConfirmed
    ? 'event'
    : stateConfirmed ? 'contract_state' : 'none';

  debugLog('stellar confirmation', {
    txHash: input.txHash,
    ledger: input.ledger,
    contractId,
    eventConfirmed: eventResult.eventConfirmed,
    stateConfirmed,
    confirmationSource,
    events: eventResult.events.length,
  });

  return {
    eventConfirmed: eventResult.eventConfirmed,
    stateConfirmed,
    confirmationSource,
    commitmentHash: input.commitmentHash ?? undefined,
    periodHash: input.periodHash ?? undefined,
    events: eventResult.events,
  };
}

async function diagnoseTransactionEvents(input: {
  txHash: string;
  ledger?: number | null;
  contractId?: string | null;
  commitmentHash?: string | null;
  periodHash?: string | null;
}): Promise<StellarConfirmationResult> {
  return confirmPayrollRegistration(input);
}

async function confirmPayrollEvent(
  server: any,
  contractId: string,
  ledger: number,
  txHash: string,
  commitmentHash: string,
  periodHash: string,
): Promise<{ eventConfirmed: boolean; events: DecodedStellarEvent[] }> {
  try {
    const response = await server.getEvents({
      startLedger: Math.max(1, ledger - 10),
      filters: [{ type: 'contract', contractIds: [contractId] }],
      limit: 100,
    });

    const events = (response.events ?? []).map((event: any) =>
      decodeStellarEvent(event, commitmentHash, periodHash),
    );

    const eventConfirmed = events.some((event: DecodedStellarEvent) => {
      const sameTx = !txHash || event.txHash === txHash;
      return sameTx && event.matchesEventName && event.matchesCommitment && event.matchesPeriod;
    });

    return { eventConfirmed, events };
  } catch {
    return { eventConfirmed: false, events: [] };
  }
}

async function confirmContractState(server: any, contractId: string, commitmentHash: string): Promise<boolean> {
  if (!contractId || !commitmentHash || !STELLAR_SECRET_KEY) return false;

  try {
    const stellar = await import('@stellar/stellar-sdk');
    const { BASE_FEE, Contract, Keypair, Networks, TransactionBuilder, xdr } = stellar;
    const sourceKeypair = Keypair.fromSecret(STELLAR_SECRET_KEY);
    const sourceAccount = await server.getAccount(sourceKeypair.publicKey());
    const contract = new Contract(contractId);
    const tx = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(contract.call('is_verified', xdr.ScVal.scvBytes(fieldToBytes32(commitmentHash))))
      .setTimeout(60)
      .build();

    const simulated = await server.simulateTransaction(tx);
    return scValToBoolean((simulated as any).result?.retval ?? (simulated as any).results?.[0]?.xdr);
  } catch (err) {
    debugLog('stellar state confirmation failed', { error: (err as Error).message });
    return false;
  }
}

function decodeStellarEvent(event: any, commitmentHash: string, periodHash: string): DecodedStellarEvent {
  // PayrollRegistry emits topics (Symbol("payroll_verified"), commitment: BytesN<32>)
  // and data period_hash: BytesN<32>.
  const topics = (event.topic ?? event.topics ?? []).map((topic: any) => scValToString(topic));
  const data = scValToString(event.value ?? event.data ?? null) || null;
  const normalizedCommitment = normalizeHex32(commitmentHash);
  const normalizedPeriod = normalizeHex32(periodHash);

  return {
    txHash: event.txHash ?? event.transactionHash ?? event.tx_hash ?? null,
    ledger: Number(event.ledger ?? event.ledgerSeq ?? event.ledgerSequence ?? 0) || null,
    contractId: event.contractId ?? event.contract_id ?? null,
    topics,
    data,
    matchesEventName: topics.includes('payroll_verified'),
    matchesCommitment: !normalizedCommitment || topics.some((topic: string) => normalizeHex32(topic) === normalizedCommitment),
    matchesPeriod: !normalizedPeriod || normalizeHex32(data) === normalizedPeriod,
  };
}

function scValToString(value: any): string {
  if (!value) return '';

  if (typeof value === 'string') return value;

  if (typeof value?.sym === 'function') {
    return value.sym().toString();
  }

  if (typeof value?.str === 'function') {
    return value.str().toString();
  }

  if (typeof value?.bytes === 'function') {
    return `0x${Buffer.from(value.bytes()).toString('hex')}`;
  }

  if (typeof value?.switch === 'function' && value.switch().name === 'scvBytes' && typeof value.bytes === 'function') {
    return `0x${Buffer.from(value.bytes()).toString('hex')}`;
  }

  return '';
}

function scValToBoolean(value: any): boolean {
  if (!value) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value?.b === 'function') return Boolean(value.b());
  if (typeof value?.switch === 'function' && value.switch().name === 'scvBool' && typeof value.b === 'function') {
    return Boolean(value.b());
  }
  return false;
}

function normalizeHex32(value: string | null | undefined): string {
  if (!value) return '';
  try {
    const bigint = value.startsWith('0x') ? BigInt(value) : BigInt(`0x${value}`);
    return `0x${bigint.toString(16).padStart(64, '0').slice(-64)}`;
  } catch {
    return value.toLowerCase();
  }
}

function debugLog(message: string, data: Record<string, unknown>): void {
  if (process.env.APP_ENV !== 'development') return;
  console.info(`[stellar] ${message}`, data);
}

function simulateVerification(input: PayrollRegistryVerificationInput): StellarVerifyResult {
  const txHash = '0x' + crypto
    .createHash('sha256')
    .update(`stellar-sim:${input.commitmentHash}:${Date.now()}`)
    .digest('hex');

  return {
    success: true,
    txHash,
    contractId: `SIMULATED_ZENTA_REGISTRY_${input.commitmentHash.substring(0, 8).toUpperCase()}`,
    status: 'SIMULATED_VERIFIED',
    verificationMode: 'SIMULATED',
    ledger: Math.floor(Math.random() * 1000000) + 50000000,
    eventConfirmed: true,
    stateConfirmed: true,
    confirmationSource: 'simulated',
    commitmentHash: input.commitmentHash,
    periodHash: input.periodHash,
  };
}

export const stellarService = {
  submitPayrollRegistryVerification,
  verifyPayroll,
  confirmPayrollRegistration,
  diagnoseTransactionEvents,
};
