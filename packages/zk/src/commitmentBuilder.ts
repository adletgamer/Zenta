import crypto from 'crypto';

const { buildPoseidon } = require('circomlibjs');

export type Fieldish = string | number | bigint;

export interface PayrollCircuitInput {
  operator_code_hash: string;
  role_code: string;
  processed_pairs: string;
  rate_per_pair: string;
  bonus: string;
  penalty: string;
  expected_payment: string;
  nonce: string;
  commitment?: string;
  period_hash: string;
}

export interface LegacyPayrollCircuitInput {
  operatorCodeHash?: Fieldish;
  roleCode?: Fieldish;
  processedPairs?: Fieldish;
  ratePerPair?: Fieldish;
  expectedPayment?: Fieldish;
  periodHash?: Fieldish;
}

type Poseidon = ((inputs: bigint[]) => unknown) & { F: { toObject: (value: unknown) => bigint } };

let poseidonPromise: Promise<Poseidon> | null = null;

async function getPoseidon(): Promise<Poseidon> {
  if (!poseidonPromise) {
    poseidonPromise = buildPoseidon();
  }

  return poseidonPromise;
}

export function toFieldString(value: Fieldish): string {
  return BigInt(value).toString();
}

export function hashStringToField(value: string): string {
  const hex = crypto.createHash('sha256').update(value).digest('hex').slice(0, 62);
  return BigInt(`0x${hex}`).toString();
}

export function toScaledInteger(value: number | string | bigint): string {
  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`Cannot scale non-finite number: ${value}`);
    }

    return BigInt(Math.round(value * 100)).toString();
  }

  const trimmed = value.trim();
  if (/^-?\d+$/.test(trimmed)) {
    return BigInt(trimmed).toString();
  }

  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric)) {
    throw new Error(`Cannot scale non-numeric value: ${value}`);
  }

  return BigInt(Math.round(numeric * 100)).toString();
}

export function randomFieldNonce(): string {
  return BigInt(`0x${crypto.randomBytes(31).toString('hex')}`).toString();
}

export function normalizePayrollCircuitInput(
  input: PayrollCircuitInput | (Partial<PayrollCircuitInput> & LegacyPayrollCircuitInput),
): PayrollCircuitInput {
  const legacy = input as LegacyPayrollCircuitInput;
  const normalized = {
    operator_code_hash: input.operator_code_hash ?? legacy.operatorCodeHash,
    role_code: input.role_code ?? legacy.roleCode,
    processed_pairs: input.processed_pairs ?? legacy.processedPairs,
    rate_per_pair: input.rate_per_pair ?? legacy.ratePerPair,
    bonus: input.bonus,
    penalty: input.penalty,
    expected_payment: input.expected_payment ?? legacy.expectedPayment,
    period_hash: input.period_hash ?? legacy.periodHash,
    nonce: input.nonce,
    commitment: input.commitment,
  };

  for (const [key, value] of Object.entries(normalized)) {
    if (key !== 'commitment' && (value === undefined || value === null || value === '')) {
      throw new Error(`Missing payroll circuit input field: ${key}`);
    }
  }

  return {
    operator_code_hash: toFieldString(normalized.operator_code_hash as Fieldish),
    role_code: toFieldString(normalized.role_code as Fieldish),
    processed_pairs: toFieldString(normalized.processed_pairs as Fieldish),
    rate_per_pair: toFieldString(normalized.rate_per_pair as Fieldish),
    bonus: toFieldString(normalized.bonus as Fieldish),
    penalty: toFieldString(normalized.penalty as Fieldish),
    expected_payment: toFieldString(normalized.expected_payment as Fieldish),
    period_hash: toFieldString(normalized.period_hash as Fieldish),
    nonce: toFieldString(normalized.nonce as Fieldish),
    commitment: normalized.commitment === undefined ? undefined : toFieldString(normalized.commitment),
  };
}

export function getCommitmentPreimage(input: PayrollCircuitInput): string[] {
  const normalized = normalizePayrollCircuitInput(input);
  return [
    normalized.operator_code_hash,
    normalized.role_code,
    normalized.processed_pairs,
    normalized.rate_per_pair,
    normalized.bonus,
    normalized.penalty,
    normalized.expected_payment,
    normalized.period_hash,
    normalized.nonce,
  ];
}

export function buildCommitmentInputDigest(input: PayrollCircuitInput): string {
  return getCommitmentPreimage(input).join('|');
}

export async function buildPayrollCommitment(
  input: PayrollCircuitInput | (Partial<PayrollCircuitInput> & LegacyPayrollCircuitInput),
): Promise<string> {
  const normalized = normalizePayrollCircuitInput(input);
  const poseidon = await getPoseidon();
  const values = getCommitmentPreimage(normalized).map(BigInt);
  return poseidon.F.toObject(poseidon(values)).toString();
}

export async function withPayrollCommitment(
  input: PayrollCircuitInput | (Partial<PayrollCircuitInput> & LegacyPayrollCircuitInput),
): Promise<PayrollCircuitInput> {
  const normalized = normalizePayrollCircuitInput(input);
  return {
    ...normalized,
    commitment: normalized.commitment ?? (await buildPayrollCommitment(normalized)),
  };
}
