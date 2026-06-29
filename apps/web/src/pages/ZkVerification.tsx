import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { zkApi, ZkVerification as ZkVerif } from '../api/zk';
import { ProofStatusBadge } from '../components/Badges';

function stellarExplorerUrl(txHash: string): string {
  return `https://stellar.expert/explorer/testnet/tx/${txHash}`;
}

function short(value: string, head = 10, tail = 8): string {
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

export function ZkVerification() {
  const { data: verifsRes, loading, error, refetch } = useApi(() => zkApi.list());
  const verifs = verifsRes?.data || [];
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const stats = buildStats(verifs);

  async function runAction(action: () => Promise<unknown>, label: string) {
    setActionLoading(label);
    setActionError(null);
    setActionMessage(null);
    try {
      await action();
      refetch();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">ZK Verification Center</h1>
          <p className="page-subtitle">Poseidon commitments, Circom witness generation, Groth16 proofs, and Stellar registry receipts.</p>
        </div>
        <span className="topbar-badge stellar">REAL ZK PIPELINE</span>
      </div>

      <div className="simulation-warning mb-4">
        Manual audit flow: Poseidon commitment {'->'} Circom payroll.circom witness {'->'} Groth16 proof {'->'} off-chain verification {'->'} Stellar testnet registry.
      </div>

      <div className="zk-center-summary mb-4">
        <SummaryMetric label="Total proofs" value={String(stats.total)} />
        <SummaryMetric label="Ready for Stellar" value={String(stats.readyForStellar)} tone="info" />
        <SummaryMetric label="Stellar receipts" value={String(stats.stellarVerified)} tone="success" />
        <SummaryMetric label="Latest tx" value={stats.latestTxHash ? short(stats.latestTxHash, 12, 8) : '-'} mono />
      </div>

      {(error || actionError) && <div className="error-banner">{error || actionError}</div>}
      {actionMessage && <div className="simulation-warning mb-4">{actionMessage}</div>}

      {loading ? (
        <div className="loading-container"><div className="spinner" /></div>
      ) : verifs.length === 0 ? (
        <div className="table-container">
          <div className="table-empty">
            <div className="table-empty-icon">ZK</div>
            <p>No ZK verifications yet. Generate a payroll commitment first.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {verifs.map(v => (
            <ZkCard key={v.id} verif={v} onAction={runAction} actionLoading={actionLoading} onMessage={setActionMessage} />
          ))}
        </div>
      )}
    </div>
  );
}

function ZkCard({ verif, onAction, actionLoading, onMessage }: {
  verif: ZkVerif;
  onAction: (action: () => Promise<unknown>, label: string) => void;
  actionLoading: string | null;
  onMessage: (message: string) => void;
}) {
  const [showProof, setShowProof] = useState(false);
  const isVerified = verif.proofStatus === 'VERIFIED' || verif.proofStatus === 'STELLAR_VERIFIED';
  const isGenerated = verif.proofStatus === 'GENERATED' || verif.proofStatus === 'PROOF_GENERATED';
  const isOffchainVerified = verif.proofStatus === 'OFFCHAIN_VERIFIED';
  const isStellarPending = verif.proofStatus === 'STELLAR_PENDING';
  const isFailed = verif.proofStatus === 'STELLAR_FAILED' || verif.proofStatus === 'FAILED';
  const zkCommitment = verif.payrollCalculation?.zkCommitment;
  const proofData = parseJson(verif.proofData);
  const publicSignals = parseJson(verif.publicSignals);
  const canVerifyStellar = isOffchainVerified;
  const statusDetails = getStatusDetails(verif.proofStatus);
  const criticalHash = verif.stellarTxHash || verif.commitmentHash;
  const evidenceLabel = verif.stellarTxHash ? 'Stellar tx hash' : 'Commitment hash';
  const proofActionId = `proof-${verif.zkProofId}`;
  const offchainActionId = `offchain-${verif.zkProofId}`;
  const stellarActionId = `stellar-${verif.zkProofId}`;

  return (
    <div className={`zk-card ${isVerified ? 'verified' : isGenerated ? 'generated' : isFailed ? 'failed' : ''}`}>
      <div className="zk-card-top">
        <div className="zk-card-title-block">
          <div className="flex items-center gap-3 mb-4">
            <ProofStatusBadge status={verif.proofStatus} />
            <span className="badge badge-proof-verified">{verif.proofSystem || 'Groth16'}</span>
            <span className="badge badge-proof-generated">{verif.commitmentScheme || zkCommitment?.hashAlgorithm || 'Poseidon'}</span>
            <span className="badge badge-proof-generated">Circom</span>
          </div>
          <div style={{ fontSize: '14px', fontWeight: 700 }}>
            {verif.payrollCalculation?.operator?.displayName || 'Unknown operator'}
          </div>
          <div className="text-sm text-muted">
            {verif.payrollCalculation?.periodLabel} - {verif.payrollCalculation?.processedPairs || 0} units - ${verif.payrollCalculation?.expectedPayment.toFixed(2)}
          </div>
          <ZkStepFlow status={verif.proofStatus} />
        </div>

        <div className="zk-action-row">
          {verif.proofStatus === 'COMMITMENT_GENERATED' && (
            <button
              className="btn btn-sm btn-secondary"
              disabled={actionLoading === proofActionId}
              onClick={() => onAction(() => zkApi.generateProof(verif.payrollCalculationId), proofActionId)}
            >
              {actionLoading === proofActionId ? 'Generating...' : 'Generar Proof'}
            </button>
          )}
          {isGenerated && (
            <button
              className="btn btn-sm btn-secondary"
              disabled={actionLoading === offchainActionId}
              onClick={() => onAction(() => zkApi.verifyOffchainProof(verif.zkProofId), offchainActionId)}
            >
              {actionLoading === offchainActionId ? 'Checking...' : 'Verificar Off-chain'}
            </button>
          )}
          {!isVerified && !isStellarPending && (
            <button
              className="btn btn-sm btn-primary"
              disabled={!canVerifyStellar || actionLoading === stellarActionId}
              title={canVerifyStellar ? 'Submit verified commitment to Stellar Testnet' : 'First generate proof and verify off-chain.'}
              onClick={() => {
                if (!canVerifyStellar) {
                  onMessage('First generate proof and verify off-chain.');
                  return;
                }
                onAction(() => zkApi.verifyProofOnStellar(verif.zkProofId), stellarActionId);
              }}
            >
              {actionLoading === stellarActionId ? 'Verifying...' : 'Verify on Stellar'}
            </button>
          )}
          {!canVerifyStellar && !isVerified && !isStellarPending && (
            <div className="zk-action-hint">First generate proof and verify off-chain.</div>
          )}
          {verif.proofData && (
            <button className="btn btn-sm btn-ghost" onClick={() => setShowProof(s => !s)}>
              {showProof ? 'Hide Proof' : 'View Proof'}
            </button>
          )}
        </div>
      </div>

      <div className="zk-evidence-hero">
        <div className="zk-evidence-main">
          <div className="text-xs text-muted mb-4">{evidenceLabel}</div>
          <div className="hash-highlight zk-evidence-hash" title={criticalHash}>
            {short(criticalHash, 16, 12)}
          </div>
        </div>
        <div className="zk-evidence-status">
          <span className={`zk-status-dot ${statusDetails.tone}`} />
          <div>
            <div className="zk-status-title">{statusDetails.title}</div>
            <div className="zk-status-copy">{statusDetails.copy}</div>
          </div>
        </div>
        <div className="zk-next-step">
          <div className="text-xs text-muted mb-4">NEXT STEP</div>
          <div>{statusDetails.next}</div>
        </div>
      </div>

      <div className="zk-hash-grid">
        <HashBlock label="COMMITMENT HASH" value={verif.commitmentHash} highlight />
        {verif.commitmentField && <HashBlock label="POSEIDON FIELD" value={verif.commitmentField} />}
        <HashBlock label="PERIOD HASH" value={verif.periodHash} />
        {zkCommitment?.poseidonInputDigest && <HashBlock label="POSEIDON INPUT DIGEST" value={zkCommitment.poseidonInputDigest} />}
        {verif.stellarTxHash && <HashBlock label="STELLAR TESTNET TX" value={verif.stellarTxHash} highlight href={stellarExplorerUrl(verif.stellarTxHash)} />}
        {verif.stellarContractId && <HashBlock label="STELLAR CONTRACT" value={verif.stellarContractId} />}
        {verif.ledger && <HashBlock label="STELLAR LEDGER" value={String(verif.ledger)} />}
        <HashBlock label="EVENT CONFIRMED" value={verif.eventConfirmed ? 'true' : 'false'} />
        {verif.stateConfirmed !== undefined && <HashBlock label="STATE CONFIRMED" value={verif.stateConfirmed ? 'true' : 'false'} />}
        {verif.confirmationSource && <HashBlock label="CONFIRMATION SOURCE" value={verif.confirmationSource} />}
        {verif.verifiedAt && (
          <div>
            <div className="text-xs text-muted mb-4">VERIFIED AT</div>
            <div className="text-sm">{new Date(verif.verifiedAt).toLocaleString()}</div>
          </div>
        )}
      </div>

      {verif.stellarTxHash && (
        <div className="stellar-receipt">
          <div>
            <div className="text-xs text-muted mb-4">STELLAR TESTNET RECEIPT</div>
            <div className="hash-highlight" title={verif.stellarTxHash}>{short(verif.stellarTxHash, 12, 10)}</div>
          </div>
          <a className="btn btn-sm btn-secondary" href={stellarExplorerUrl(verif.stellarTxHash)} target="_blank" rel="noreferrer">
            Open in Stellar Explorer
          </a>
          <div className="receipt-flags">
            <span className={`badge ${verif.eventConfirmed ? 'badge-proof-verified' : 'badge-proof-not-generated'}`}>event {verif.eventConfirmed ? 'true' : 'false'}</span>
            <span className={`badge ${verif.stateConfirmed ? 'badge-proof-verified' : 'badge-proof-not-generated'}`}>state {verif.stateConfirmed ? 'true' : 'false'}</span>
            <span className="badge badge-proof-generated">{verif.confirmationSource || 'none'}</span>
            {verif.ledger && <span className="badge badge-proof-generated">ledger {verif.ledger}</span>}
          </div>
        </div>
      )}

      {showProof && verif.proofData && (
        <div className="mt-4">
          <div className="proof-grid">
            <div>
              <div className="text-xs text-muted mb-4">PUBLIC SIGNALS</div>
              <div className="zk-proof-data">{JSON.stringify(publicSignals, null, 2)}</div>
            </div>
            <div>
              <div className="text-xs text-muted mb-4">GROTH16 PROOF JSON</div>
              <div className="zk-proof-data">{JSON.stringify(proofData, null, 2)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryMetric({ label, value, tone, mono = false }: { label: string; value: string; tone?: 'info' | 'success'; mono?: boolean }) {
  return (
    <div className={`zk-summary-metric ${tone || ''}`}>
      <div className="text-xs text-muted">{label}</div>
      <div className={mono ? 'hash-highlight' : 'zk-summary-value'}>{value}</div>
    </div>
  );
}

function buildStats(verifs: ZkVerif[]) {
  return {
    total: verifs.length,
    readyForStellar: verifs.filter(v => v.proofStatus === 'OFFCHAIN_VERIFIED').length,
    stellarVerified: verifs.filter(v => v.proofStatus === 'STELLAR_VERIFIED' || v.proofStatus === 'VERIFIED').length,
    latestTxHash: verifs.find(v => v.stellarTxHash)?.stellarTxHash || null,
  };
}

function getStatusDetails(status: string) {
  const details: Record<string, { title: string; copy: string; next: string; tone: string }> = {
    COMMITMENT_GENERATED: {
      title: 'Commitment ready',
      copy: 'Poseidon commitment and payroll period hash are stored.',
      next: 'Generate the Groth16 proof.',
      tone: 'info',
    },
    GENERATED: {
      title: 'Proof generated',
      copy: 'Circom witness and Groth16 proof data are available.',
      next: 'Run off-chain verification.',
      tone: 'info',
    },
    PROOF_GENERATED: {
      title: 'Proof generated',
      copy: 'Circom witness and Groth16 proof data are available.',
      next: 'Run off-chain verification.',
      tone: 'info',
    },
    OFFCHAIN_VERIFIED: {
      title: 'Ready for Stellar',
      copy: 'The proof passed local verification and can be registered.',
      next: 'Submit the verified commitment to Stellar.',
      tone: 'success',
    },
    STELLAR_PENDING: {
      title: 'Submitting to Stellar',
      copy: 'The registry transaction is being processed.',
      next: 'Wait for contract confirmation.',
      tone: 'warning',
    },
    STELLAR_VERIFIED: {
      title: 'Stellar verified',
      copy: 'The registry confirmed this payroll commitment.',
      next: 'Open the receipt in Stellar Explorer.',
      tone: 'success',
    },
    VERIFIED: {
      title: 'Stellar verified',
      copy: 'The registry confirmed this payroll commitment.',
      next: 'Open the receipt in Stellar Explorer.',
      tone: 'success',
    },
    STELLAR_FAILED: {
      title: 'Stellar failed',
      copy: 'The registry submission did not finish successfully.',
      next: 'Review status and retry after fixing configuration.',
      tone: 'error',
    },
    FAILED: {
      title: 'Verification failed',
      copy: 'The proof or registry verification failed.',
      next: 'Regenerate the proof and verify again.',
      tone: 'error',
    },
  };
  return details[status] || {
    title: 'Not started',
    copy: 'No ZK proof has been generated yet.',
    next: 'Generate a Poseidon commitment.',
    tone: 'muted',
  };
}

function ZkStepFlow({ status }: { status: string }) {
  const steps = [
    { key: 'COMMITMENT_GENERATED', label: 'Commitment Generated' },
    { key: 'PROOF_GENERATED', label: 'Proof Generated' },
    { key: 'OFFCHAIN_VERIFIED', label: 'Off-chain Verified' },
    { key: 'STELLAR_VERIFIED', label: 'Verified on Stellar' },
  ];
  const indexByStatus: Record<string, number> = {
    COMMITMENT_GENERATED: 0,
    GENERATED: 1,
    PROOF_GENERATED: 1,
    OFFCHAIN_VERIFIED: 2,
    STELLAR_PENDING: 2,
    VERIFIED: 3,
    STELLAR_VERIFIED: 3,
    STELLAR_FAILED: 2,
    FAILED: 1,
  };
  const current = indexByStatus[status] ?? -1;

  return (
    <div className="zk-step-flow" aria-label="ZK verification flow">
      {steps.map((step, index) => (
        <div key={step.key} className={`zk-step ${index < current ? 'done' : index === current ? 'active' : ''}`}>
          <span className="zk-step-dot" />
          <span>{step.label}</span>
        </div>
      ))}
    </div>
  );
}

function parseJson(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function HashBlock({ label, value, highlight = false, href }: { label: string; value: string; highlight?: boolean; href?: string }) {
  return (
    <div>
      <div className="text-xs text-muted mb-4">{label}</div>
      {href ? (
        <a className={`${highlight ? 'hash-highlight' : 'hash'} hash-link truncate`} href={href} target="_blank" rel="noreferrer" title={value}>
          {highlight ? short(value) : value}
        </a>
      ) : (
        <div className={`${highlight ? 'hash-highlight' : 'hash'} hash-block-value`} title={value}>{highlight ? short(value) : value}</div>
      )}
    </div>
  );
}
