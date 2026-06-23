import {
  PayrollCircuitInput,
  buildCommitmentInputDigest,
  buildPayrollCommitment,
  hashStringToField,
  randomFieldNonce,
  toScaledInteger,
} from './commitmentBuilder';

export interface PayrollCalculationRecord {
  id?: string;
  operatorId?: string;
  periodLabel: string;
  processedPairs: number;
  ratePerPair: number;
  bonus: number;
  penalty: number;
  expectedPayment: number;
  commitmentHash?: string | null;
  periodHash?: string | null;
  operator?: {
    pseudonymousCode: string;
    specialization: string;
  };
  zkCommitment?: {
    nonce: string;
  } | null;
}

export interface BuildPayrollInputOptions {
  operatorPseudoCode?: string;
  roleCode?: string;
  periodHash?: string;
  nonce?: string;
  commitment?: string;
}

export interface BuiltPayrollInput {
  circuitInput: PayrollCircuitInput;
  commitment: string;
  periodHash: string;
  nonce: string;
  poseidonInputDigest: string;
}

function requireValue(value: string | undefined, label: string): string {
  if (!value) {
    throw new Error(`Missing ${label} for payroll circuit input`);
  }

  return value;
}

export async function buildPayrollCircuitInput(
  record: PayrollCalculationRecord,
  options: BuildPayrollInputOptions = {},
): Promise<BuiltPayrollInput> {
  const operatorPseudoCode = requireValue(
    options.operatorPseudoCode ?? record.operator?.pseudonymousCode,
    'operator pseudonymous code',
  );
  const roleCode = requireValue(options.roleCode ?? record.operator?.specialization, 'operator role code');
  const periodHash = options.periodHash ?? record.periodHash ?? hashStringToField(`period:${record.periodLabel}`);
  const nonce = options.nonce ?? record.zkCommitment?.nonce ?? randomFieldNonce();

  const circuitInput: PayrollCircuitInput = {
    operator_code_hash: hashStringToField(operatorPseudoCode),
    role_code: hashStringToField(`role:${roleCode}`),
    processed_pairs: BigInt(record.processedPairs).toString(),
    rate_per_pair: toScaledInteger(record.ratePerPair),
    bonus: toScaledInteger(record.bonus),
    penalty: toScaledInteger(record.penalty),
    expected_payment: toScaledInteger(record.expectedPayment),
    period_hash: periodHash,
    nonce,
    commitment: options.commitment ?? record.commitmentHash ?? undefined,
  };

  const commitment = circuitInput.commitment ?? (await buildPayrollCommitment(circuitInput));
  const committedCircuitInput = { ...circuitInput, commitment };

  return {
    circuitInput: committedCircuitInput,
    commitment,
    periodHash,
    nonce,
    poseidonInputDigest: buildCommitmentInputDigest(committedCircuitInput),
  };
}

export function buildRawPayrollCircuitInput(
  input: Omit<PayrollCircuitInput, 'commitment'> & { commitment?: string },
): PayrollCircuitInput {
  return {
    operator_code_hash: BigInt(input.operator_code_hash).toString(),
    role_code: BigInt(input.role_code).toString(),
    processed_pairs: BigInt(input.processed_pairs).toString(),
    rate_per_pair: BigInt(input.rate_per_pair).toString(),
    bonus: BigInt(input.bonus).toString(),
    penalty: BigInt(input.penalty).toString(),
    expected_payment: BigInt(input.expected_payment).toString(),
    period_hash: BigInt(input.period_hash).toString(),
    nonce: BigInt(input.nonce).toString(),
    commitment: input.commitment === undefined ? undefined : BigInt(input.commitment).toString(),
  };
}
