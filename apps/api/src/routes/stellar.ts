import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { derivePublicKeyFromSecret } from '../lib/stellar-keypair';
import { buildEnvDiagnostics, getStellarEnv } from '../lib/stellar-env';
import { stellarService } from '../services/stellar.service';

export const stellarRouter = Router();

const HORIZON_TESTNET_URL = 'https://horizon-testnet.stellar.org';

function derivePublicKey(secretKey: string): { publicKey: string | null; error: string | null } {
  if (!secretKey) return { publicKey: null, error: null };
  try {
    return { publicKey: derivePublicKeyFromSecret(secretKey), error: null };
  } catch (err) {
    return { publicKey: null, error: (err as Error).message };
  }
}

async function getNativeBalance(publicKey: string): Promise<string | null> {
  const response = await fetch(`${HORIZON_TESTNET_URL}/accounts/${publicKey}`);
  if (!response.ok) {
    return null;
  }

  const account = await response.json() as {
    balances?: Array<{ asset_type: string; balance: string }>;
  };
  return account.balances?.find(balance => balance.asset_type === 'native')?.balance ?? null;
}

async function getStellarStatus() {
  const env = getStellarEnv();
  const { publicKey, error: publicKeyError } = derivePublicKey(env.secretKey);
  const secretDiagnostics = buildEnvDiagnostics(process.env.STELLAR_SECRET_KEY, 'S');
  const contractDiagnostics = buildEnvDiagnostics(process.env[env.contractEnvName], 'C');
  const secretLooksValid = env.secretKey.startsWith('S');
  const contractLooksValid = env.contractId.startsWith('C');
  const modeIsRegistry = env.verificationMode === 'STELLAR_REGISTRY_TESTNET';

  const [latestVerification, latestSubmission, balance] = await Promise.all([
    prisma.onchainVerification.findFirst({
      orderBy: { submittedAt: 'desc' },
      select: {
        status: true,
        stellarTxHash: true,
        ledger: true,
        eventConfirmed: true,
        commitmentHash: true,
        periodHash: true,
        contractId: true,
        submittedAt: true,
        verifiedAt: true,
      },
    }),
    prisma.stellarSubmission.findFirst({
      orderBy: { submittedAt: 'desc' },
      select: {
        txHash: true,
        status: true,
        mode: true,
        ledger: true,
        submittedAt: true,
      },
    }),
    publicKey ? getNativeBalance(publicKey).catch(() => null) : Promise.resolve(null),
  ]);

  const configured = Boolean(publicKey && secretLooksValid && contractLooksValid && env.rpcUrl && modeIsRegistry);
  const sdkFailed = Boolean(publicKeyError);
  const health = configured
    ? 'READY'
    : sdkFailed ? 'SDK_ERROR' : 'MISSING_CONFIGURATION';
  const latestTxHash = latestVerification?.stellarTxHash ?? latestSubmission?.txHash ?? null;
  const latestLedger = latestVerification?.ledger ?? latestSubmission?.ledger ?? null;
  const latestStatus = latestVerification?.status ?? latestSubmission?.status ?? null;
  const latestContractId = latestVerification?.contractId ?? env.contractId;
  const confirmation = latestVerification?.stellarTxHash
    ? await stellarService.confirmPayrollRegistration({
        txHash: latestVerification.stellarTxHash,
        ledger: latestVerification.ledger,
        contractId: latestContractId,
        commitmentHash: latestVerification.commitmentHash,
        periodHash: latestVerification.periodHash,
      }).catch(() => null)
    : null;

  return {
    configured,
    health,
    publicKey,
    network: env.network,
    rpcUrl: env.rpcUrl,
    horizonUrl: HORIZON_TESTNET_URL,
    contractId: env.contractId,
    verificationMode: env.verificationMode,
    balance,
    latestTxHash,
    latestLedger,
    latestStatus,
    eventConfirmed: confirmation?.eventConfirmed ?? latestVerification?.eventConfirmed ?? false,
    stateConfirmed: confirmation?.stateConfirmed ?? false,
    confirmationSource: confirmation?.confirmationSource ?? 'none',
    commitmentHash: latestVerification?.commitmentHash ?? null,
    periodHash: latestVerification?.periodHash ?? null,
    latestSubmittedAt: latestVerification?.submittedAt ?? latestSubmission?.submittedAt ?? null,
    latestVerifiedAt: latestVerification?.verifiedAt ?? null,
    diagnostics: {
      secretKey: secretDiagnostics,
      contractId: contractDiagnostics,
      verificationMode: {
        value: env.verificationMode,
        isRegistryTestnet: modeIsRegistry,
      },
      sdk: {
        available: !sdkFailed,
        error: publicKeyError,
      },
    },
  };
}

stellarRouter.get('/status', async (_req, res) => {
  res.json({ success: true, data: await getStellarStatus() });
});

stellarRouter.get('/admin-status', async (_req, res) => {
  res.json({ success: true, data: await getStellarStatus() });
});

stellarRouter.get('/tx/:txHash/events', async (req, res) => {
  const txHash = req.params.txHash;
  const verification = await prisma.onchainVerification.findFirst({
    where: { stellarTxHash: txHash },
    select: {
      stellarTxHash: true,
      ledger: true,
      contractId: true,
      commitmentHash: true,
      periodHash: true,
      eventConfirmed: true,
    },
  });
  const submission = verification
    ? null
    : await prisma.stellarSubmission.findFirst({
        where: { txHash },
        select: { txHash: true, contractId: true, ledger: true },
      });

  const env = getStellarEnv();
  const contractId = verification?.contractId
    ?? submission?.contractId
    ?? env.contractId;
  const ledger = verification?.ledger ?? submission?.ledger ?? null;

  const confirmation = await stellarService.diagnoseTransactionEvents({
    txHash,
    ledger,
    contractId,
    commitmentHash: verification?.commitmentHash,
    periodHash: verification?.periodHash,
  });

  res.json({
    success: true,
    data: {
      txHash,
      ledger,
      contractId,
      eventConfirmed: confirmation.eventConfirmed,
      stateConfirmed: confirmation.stateConfirmed,
      confirmationSource: confirmation.confirmationSource,
      commitmentHash: confirmation.commitmentHash ?? verification?.commitmentHash ?? null,
      periodHash: confirmation.periodHash ?? verification?.periodHash ?? null,
      eventCount: confirmation.events.length,
      events: confirmation.events,
    },
  });
});
