import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { stellarService } from '../services/stellar.service';

export const stellarRouter = Router();

const HORIZON_TESTNET_URL = 'https://horizon-testnet.stellar.org';

function trimEnv(value: string | undefined, fallback = ''): string {
  return (value ?? fallback).trim();
}

async function importStellarSdk(): Promise<any> {
  return new Function('specifier', 'return import(specifier)')('@stellar/stellar-sdk');
}

async function deriveAdminPublicKey(secretKey: string): Promise<string | null> {
  if (!secretKey) return null;
  try {
    const { Keypair } = await importStellarSdk();
    return Keypair.fromSecret(secretKey).publicKey();
  } catch {
    return null;
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
  const secretKey = trimEnv(process.env.STELLAR_SECRET_KEY);
  const publicKey = await deriveAdminPublicKey(secretKey);
  const network = trimEnv(process.env.STELLAR_NETWORK, 'testnet');
  const rpcUrl = trimEnv(process.env.STELLAR_RPC_URL, 'https://soroban-testnet.stellar.org');
  const contractId = trimEnv(
    process.env.STELLAR_PAYROLL_REGISTRY_CONTRACT_ID,
    trimEnv(process.env.STELLAR_CONTRACT_ID),
  );
  const verificationMode = trimEnv(process.env.VERIFICATION_MODE, 'SIMULATED');

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

  const configured = Boolean(publicKey && contractId && rpcUrl);
  const latestTxHash = latestVerification?.stellarTxHash ?? latestSubmission?.txHash ?? null;
  const latestLedger = latestVerification?.ledger ?? latestSubmission?.ledger ?? null;
  const latestStatus = latestVerification?.status ?? latestSubmission?.status ?? null;
  const latestContractId = latestVerification?.contractId ?? contractId;
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
    health: configured ? 'READY' : 'MISSING_CONFIGURATION',
    publicKey,
    network,
    rpcUrl,
    horizonUrl: HORIZON_TESTNET_URL,
    contractId,
    verificationMode,
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

  const contractId = verification?.contractId
    ?? submission?.contractId
    ?? trimEnv(process.env.STELLAR_PAYROLL_REGISTRY_CONTRACT_ID, trimEnv(process.env.STELLAR_CONTRACT_ID));
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
