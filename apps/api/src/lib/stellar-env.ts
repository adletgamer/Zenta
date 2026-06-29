export interface EnvDiagnostics {
  exists: boolean;
  rawLength: number;
  cleanedLength: number;
  rawStartsWithS?: boolean;
  cleanedStartsWithS?: boolean;
  rawStartsWithC?: boolean;
  cleanedStartsWithC?: boolean;
  hasWrappingQuotes: boolean;
}

export function cleanEnvValue(value: string | undefined, fallback = ''): string {
  const trimmed = (value ?? fallback).trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

export function readEnv(name: string, fallback = ''): string {
  return cleanEnvValue(process.env[name]) || cleanEnvValue(fallback);
}

export function buildEnvDiagnostics(value: string | undefined, expectedPrefix?: 'S' | 'C'): EnvDiagnostics {
  const raw = (value ?? '').trim();
  const cleaned = cleanEnvValue(value);
  const hasWrappingQuotes = raw.length >= 2
    && ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'")));

  return {
    exists: value !== undefined && value !== '',
    rawLength: raw.length,
    cleanedLength: cleaned.length,
    ...(expectedPrefix === 'S'
      ? {
          rawStartsWithS: raw.startsWith('S'),
          cleanedStartsWithS: cleaned.startsWith('S'),
        }
      : {}),
    ...(expectedPrefix === 'C'
      ? {
          rawStartsWithC: raw.startsWith('C'),
          cleanedStartsWithC: cleaned.startsWith('C'),
        }
      : {}),
    hasWrappingQuotes,
  };
}

export function getStellarEnv() {
  const legacyContractId = readEnv('STELLAR_CONTRACT_ID');
  const payrollRegistryContractId = readEnv('STELLAR_PAYROLL_REGISTRY_CONTRACT_ID');
  const contractId = payrollRegistryContractId || legacyContractId;

  return {
    secretKey: readEnv('STELLAR_SECRET_KEY'),
    contractId,
    contractEnvName: payrollRegistryContractId ? 'STELLAR_PAYROLL_REGISTRY_CONTRACT_ID' : 'STELLAR_CONTRACT_ID',
    legacyContractId,
    payrollRegistryContractId,
    rpcUrl: readEnv('STELLAR_RPC_URL', 'https://soroban-testnet.stellar.org'),
    network: readEnv('STELLAR_NETWORK', 'testnet'),
    verificationMode: readEnv('VERIFICATION_MODE', 'SIMULATED'),
  };
}
