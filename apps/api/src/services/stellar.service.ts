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
  error?: string;
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

    const eventConfirmed = await confirmPayrollEvent(server, STELLAR_CONTRACT_ID, txResult.ledger, sent.hash);

    return {
      success: true,
      txHash: sent.hash,
      contractId: STELLAR_CONTRACT_ID,
      status: 'STELLAR_VERIFIED',
      verificationMode: 'STELLAR_REGISTRY_TESTNET',
      ledger: txResult.ledger,
      eventConfirmed,
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
      error: (err as Error).message,
    };
  }
}

async function confirmPayrollEvent(
  server: any,
  contractId: string,
  ledger: number,
  txHash: string,
): Promise<boolean> {
  try {
    const response = await server.getEvents({
      startLedger: Math.max(0, ledger - 5),
      filters: [{ type: 'contract', contractIds: [contractId] }],
      limit: 20,
    });

    return response.events?.some((event: any) => {
      const topics = event.topic ?? event.topics ?? [];
      return event.txHash === txHash && topics.some((topic: any) => scValToString(topic) === 'payroll_verified');
    }) ?? false;
  } catch {
    return false;
  }
}

function scValToString(value: any): string {
  if (typeof value?.sym === 'function') {
    return value.sym().toString();
  }

  if (typeof value?.str === 'function') {
    return value.str().toString();
  }

  if (typeof value?.bytes === 'function') {
    return Buffer.from(value.bytes()).toString('hex');
  }

  return '';
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
  };
}

export const stellarService = { submitPayrollRegistryVerification, verifyPayroll };
