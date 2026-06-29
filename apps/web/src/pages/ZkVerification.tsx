import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { zkApi, ZkVerification as ZkVerif } from '../api/zk';
import { ProofStatusBadge } from '../components/Badges';

function stellarExplorerUrl(txHash: string): string {
  return `https://stellar.expert/explorer/testnet/tx/${txHash}`;
}

export function ZkVerification() {
  const { data: verifsRes, loading, error, refetch } = useApi(() => zkApi.list());
  const verifs = verifsRes?.data || [];
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function runAction(action: () => Promise<unknown>, label: string) {
    setActionLoading(label);
    setActionError(null);
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

      {(error || actionError) && <div className="error-banner">{error || actionError}</div>}

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
            <ZkCard key={v.id} verif={v} onAction={runAction} actionLoading={actionLoading} />
          ))}
        </div>
      )}
    </div>
  );
}

function ZkCard({ verif, onAction, actionLoading }: {
  verif: ZkVerif;
  onAction: (action: () => Promise<unknown>, label: string) => void;
  actionLoading: string | null;
}) {
  const [showProof, setShowProof] = useState(false);
  const isVerified = verif.proofStatus === 'VERIFIED';
  const isGenerated = verif.proofStatus === 'GENERATED';
  const isOffchainVerified = verif.proofStatus === 'OFFCHAIN_VERIFIED';
  const zkCommitment = verif.payrollCalculation?.zkCommitment;
  const proofData = parseJson(verif.proofData);
  const publicSignals = parseJson(verif.publicSignals);

  return (
    <div className={`zk-card ${isVerified ? 'verified' : isGenerated ? 'generated' : ''}`}>
      <div className="zk-card-top">
        <div>
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
        </div>

        <div className="flex gap-2">
          {verif.proofStatus === 'COMMITMENT_GENERATED' && (
            <button
              className="btn btn-sm btn-secondary"
              disabled={actionLoading === `proof-${verif.payrollCalculationId}`}
              onClick={() => onAction(() => zkApi.generateProof(verif.payrollCalculationId), `proof-${verif.payrollCalculationId}`)}
            >
              {actionLoading === `proof-${verif.payrollCalculationId}` ? 'Generating...' : 'Generar Proof'}
            </button>
          )}
          {isGenerated && (
            <button
              className="btn btn-sm btn-secondary"
              disabled={actionLoading === `offchain-${verif.payrollCalculationId}`}
              onClick={() => onAction(() => zkApi.verifyOffchain(verif.payrollCalculationId), `offchain-${verif.payrollCalculationId}`)}
            >
              {actionLoading === `offchain-${verif.payrollCalculationId}` ? 'Checking...' : 'Verificar Off-chain'}
            </button>
          )}
          {isOffchainVerified && (
            <button
              className="btn btn-sm btn-primary"
              disabled={actionLoading === `stellar-${verif.payrollCalculationId}`}
              onClick={() => onAction(() => zkApi.verifyOnStellar(verif.payrollCalculationId), `stellar-${verif.payrollCalculationId}`)}
            >
              {actionLoading === `stellar-${verif.payrollCalculationId}` ? 'Verifying...' : 'Verificar'}
            </button>
          )}
          {verif.proofData && (
            <button className="btn btn-sm btn-ghost" onClick={() => setShowProof(s => !s)}>
              {showProof ? 'Hide Proof' : 'View Proof'}
            </button>
          )}
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
          {value}
        </a>
      ) : (
        <div className={`${highlight ? 'hash-highlight' : 'hash'} truncate`} title={value}>{value}</div>
      )}
    </div>
  );
}
