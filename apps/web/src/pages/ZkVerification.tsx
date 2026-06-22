import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { zkApi, ZkVerification as ZkVerif } from '../api/zk';
import { ProofStatusBadge } from '../components/Badges';

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
          <p className="page-subtitle">Commitments with POSEIDON_SIMULATED, proof envelopes, and simulated Stellar receipts.</p>
        </div>
        <span className="topbar-badge simulated">SIMULATED MODE</span>
      </div>

      <div className="simulation-warning mb-4">
        SIMULATED only. Circom/Poseidon real proof generation is intentionally out of this V1.
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
  const zkCommitment = verif.payrollCalculation?.zkCommitment;

  return (
    <div className={`zk-card ${isVerified ? 'verified' : isGenerated ? 'generated' : ''}`}>
      <div className="zk-card-top">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <ProofStatusBadge status={verif.proofStatus} />
            <span className="badge badge-simulated">SIMULATED</span>
            <span className="badge badge-proof-generated">{zkCommitment?.hashAlgorithm || 'POSEIDON_SIMULATED'}</span>
          </div>
          <div style={{ fontSize: '14px', fontWeight: 700 }}>
            {verif.payrollCalculation?.operator?.displayName || 'Unknown operator'}
          </div>
          <div className="text-sm text-muted">
            {verif.payrollCalculation?.periodLabel} - {verif.payrollCalculation?.processedPairs || 0} units - ${verif.payrollCalculation?.expectedPayment.toFixed(2)}
          </div>
        </div>

        <div className="flex gap-2">
          {verif.proofStatus === 'GENERATING' && (
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
        <HashBlock label="PERIOD HASH" value={verif.periodHash} />
        {zkCommitment?.poseidonInputDigest && <HashBlock label="POSEIDON INPUT DIGEST" value={zkCommitment.poseidonInputDigest} />}
        {verif.stellarTxHash && <HashBlock label="SIMULATED STELLAR TX" value={verif.stellarTxHash} highlight />}
        {verif.stellarContractId && <HashBlock label="SIMULATED CONTRACT" value={verif.stellarContractId} />}
        {verif.verifiedAt && (
          <div>
            <div className="text-xs text-muted mb-4">VERIFIED AT</div>
            <div className="text-sm">{new Date(verif.verifiedAt).toLocaleString()}</div>
          </div>
        )}
      </div>

      {showProof && verif.proofData && (
        <div className="mt-4">
          <div className="text-xs text-muted mb-4">SIMULATED PROOF DATA</div>
          <div className="zk-proof-data">{JSON.stringify(JSON.parse(verif.proofData), null, 2)}</div>
        </div>
      )}
    </div>
  );
}

function HashBlock({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted mb-4">{label}</div>
      <div className={`${highlight ? 'hash-highlight' : 'hash'} truncate`} title={value}>{value}</div>
    </div>
  );
}
