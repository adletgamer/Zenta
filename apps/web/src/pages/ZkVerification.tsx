import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { zkApi, ZkVerification as ZkVerif } from '../api/zk';
import { payrollApi } from '../api/payroll';
import { ProofStatusBadge } from '../components/Badges';

export function ZkVerification() {
  const { data: verifsRes, loading, error, refetch: refetchVerifs } = useApi(() => zkApi.list());
  const { data: calcsRes, refetch: refetchCalcs } = useApi(() => payrollApi.operators());
  const verifs = verifsRes?.data || [];
  const calcs = (calcsRes?.data || []).filter(c => !c.commitmentHash);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const verificationMode = import.meta.env.VITE_VERIFICATION_MODE || 'SIMULATED';

  function refetch() { refetchVerifs(); refetchCalcs(); }

  async function runAction(action: () => Promise<unknown>, label: string) {
    setActionLoading(label); setActionError(null);
    try { await action(); refetch(); }
    catch (err) { setActionError((err as Error).message); }
    finally { setActionLoading(null); }
  }

  const verified = verifs.filter(v => v.proofStatus === 'VERIFIED').length;
  const generated = verifs.filter(v => v.proofStatus === 'GENERATED').length;
  const failed = verifs.filter(v => v.proofStatus === 'FAILED').length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">ZK Verification Center</h1>
          <p className="page-subtitle">Groth16 payroll proofs · Stellar Soroban registry</p>
        </div>
        <div className={`topbar-badge ${verificationMode === 'STELLAR_TESTNET' ? 'stellar' : 'simulated'}`}>
          ⬡ {verificationMode === 'STELLAR_TESTNET' ? 'STELLAR_TESTNET' : 'SIMULATED MODE'}
        </div>
      </div>

      {/* Simulation Warning */}
      {verificationMode === 'SIMULATED' && (
        <div className="simulation-warning" style={{ marginBottom: '20px', padding: '12px 16px', borderRadius: '6px' }}>
          ⚠ SIMULATION MODE — ZK proofs and Stellar verification are cryptographically structured but not submitted to a real blockchain.
          Set VERIFICATION_MODE=STELLAR_TESTNET and configure STELLAR_CONTRACT_ID to enable real on-chain verification.
        </div>
      )}

      {actionError && <div className="error-banner">{actionError}</div>}

      {/* KPIs */}
      <div className="kpi-grid" style={{ marginBottom: '24px' }}>
        <div className="kpi-card green">
          <div className="kpi-label">Verified</div>
          <div className="kpi-value">{loading ? '—' : verified}</div>
          <div className="kpi-meta">Proofs verified</div>
        </div>
        <div className="kpi-card blue">
          <div className="kpi-label">Generated</div>
          <div className="kpi-value">{loading ? '—' : generated}</div>
          <div className="kpi-meta">Awaiting Stellar</div>
        </div>
        <div className="kpi-card orange">
          <div className="kpi-label">Pending</div>
          <div className="kpi-value">{loading ? '—' : calcs.length}</div>
          <div className="kpi-meta">Need commitment</div>
        </div>
        {failed > 0 && (
          <div className="kpi-card" style={{ borderTop: '2px solid var(--color-error)' }}>
            <div className="kpi-label">Failed</div>
            <div className="kpi-value text-error">{failed}</div>
          </div>
        )}
      </div>

      {/* Payrolls needing commitment */}
      {calcs.length > 0 && (
        <div className="table-container" style={{ marginBottom: '24px' }}>
          <div className="table-header">
            <span className="table-title">Payrolls Awaiting ZK Commitment</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Operator</th>
                <th>Period</th>
                <th className="text-right">Amount</th>
                <th>Status</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {calcs.map(calc => (
                <tr key={calc.id}>
                  <td style={{ fontWeight: 600 }}>{calc.operator?.displayName}</td>
                  <td className="text-muted">{calc.periodLabel}</td>
                  <td className="text-right">${calc.expectedPayment.toFixed(2)}</td>
                  <td><ProofStatusBadge status={calc.proofStatus} /></td>
                  <td className="text-center">
                    <button
                      className="btn btn-sm btn-secondary"
                      disabled={actionLoading === `commit-${calc.id}`}
                      onClick={() => runAction(() => zkApi.generateCommitment(calc.id), `commit-${calc.id}`)}
                    >
                      {actionLoading === `commit-${calc.id}` ? 'Generating…' : 'Generate Commitment'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Verification Cards */}
      {loading ? (
        <div className="loading-container"><div className="spinner" /></div>
      ) : verifs.length === 0 ? (
        <div className="table-container"><div className="table-empty"><div className="table-empty-icon">⬡</div><p>No ZK verifications yet. Calculate payroll and generate commitments first.</p></div></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {verifs.map(v => <ZkCard key={v.id} verif={v} onAction={runAction} actionLoading={actionLoading} />)}
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
  const isSimulated = verif.verificationMode === 'SIMULATED';

  return (
    <div className={`zk-card ${isVerified ? 'verified' : isGenerated ? 'generated' : ''}`}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <ProofStatusBadge status={verif.proofStatus} />
            {isSimulated && <span className="badge badge-simulated">⚠ SIMULATED</span>}
            {verif.verificationMode === 'STELLAR_TESTNET' && <span className="badge" style={{ color: 'var(--color-info)', background: 'var(--color-info-bg)' }}>🌟 STELLAR_TESTNET</span>}
          </div>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>
            {verif.payrollCalculation?.operator?.displayName} · {verif.payrollCalculation?.periodLabel}
          </div>
          {verif.payrollCalculation?.expectedPayment && (
            <div style={{ fontSize: '13px', color: 'var(--color-on-surface-muted)' }}>
              Expected: <strong style={{ color: 'var(--color-on-surface)' }}>${verif.payrollCalculation.expectedPayment.toFixed(2)}</strong>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {isGenerated && (
            <button
              className="btn btn-sm btn-primary"
              disabled={actionLoading === `stellar-${verif.payrollCalculationId}`}
              onClick={() => onAction(() => zkApi.verifyOnStellar(verif.payrollCalculationId), `stellar-${verif.payrollCalculationId}`)}
            >
              {actionLoading === `stellar-${verif.payrollCalculationId}` ? 'Submitting…' : '⬡ Verify on Stellar'}
            </button>
          )}
          {verif.proofStatus === 'GENERATING' && (
            <button
              className="btn btn-sm btn-secondary"
              disabled={actionLoading === `proof-${verif.payrollCalculationId}`}
              onClick={() => onAction(() => zkApi.generateProof(verif.payrollCalculationId), `proof-${verif.payrollCalculationId}`)}
            >
              {actionLoading === `proof-${verif.payrollCalculationId}` ? 'Generating…' : 'Generate Proof'}
            </button>
          )}
          {verif.proofData && (
            <button className="btn btn-sm btn-ghost" onClick={() => setShowProof(s => !s)}>
              {showProof ? 'Hide Proof' : 'View Proof'}
            </button>
          )}
        </div>
      </div>

      {/* Hash display */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '16px' }}>
        <div>
          <div className="text-xs text-muted" style={{ marginBottom: '4px' }}>COMMITMENT HASH</div>
          <div className="hash-highlight truncate" title={verif.commitmentHash}>{verif.commitmentHash}</div>
        </div>
        <div>
          <div className="text-xs text-muted" style={{ marginBottom: '4px' }}>PERIOD HASH</div>
          <div className="hash truncate" title={verif.periodHash}>{verif.periodHash}</div>
        </div>
        {verif.stellarTxHash && (
          <div style={{ gridColumn: '1 / -1' }}>
            <div className="text-xs text-muted" style={{ marginBottom: '4px' }}>STELLAR TX HASH</div>
            <div className="hash-highlight truncate" title={verif.stellarTxHash}>{verif.stellarTxHash}</div>
          </div>
        )}
        {verif.stellarContractId && (
          <div>
            <div className="text-xs text-muted" style={{ marginBottom: '4px' }}>CONTRACT ID</div>
            <div className="hash truncate" title={verif.stellarContractId}>{verif.stellarContractId}</div>
          </div>
        )}
        {verif.verifiedAt && (
          <div>
            <div className="text-xs text-muted" style={{ marginBottom: '4px' }}>VERIFIED AT</div>
            <div style={{ fontSize: '12px' }}>{new Date(verif.verifiedAt).toLocaleString()}</div>
          </div>
        )}
      </div>

      {/* Proof data (collapsible) */}
      {showProof && verif.proofData && (
        <div style={{ marginTop: '16px' }}>
          <div className="text-xs text-muted" style={{ marginBottom: '4px' }}>GROTH16 PROOF DATA</div>
          <div className="zk-proof-data">{JSON.stringify(JSON.parse(verif.proofData), null, 2)}</div>
        </div>
      )}
    </div>
  );
}
