import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { payrollApi } from '../api/payroll';
import { zkApi, ZkQueueItem } from '../api/zk';
import { ProofStatusBadge } from '../components/Badges';

export function Dashboard() {
  const { data: payrollRes, loading: payrollLoading } = useApi(() => payrollApi.summary());
  const { data: zkSummaryRes, loading: zkSummaryLoading, refetch: refetchSummary } = useApi(() => zkApi.summary());
  const { data: queueRes, loading: queueLoading, refetch: refetchQueue } = useApi(() => zkApi.queue());
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const payroll = payrollRes?.data;
  const zkSummary = zkSummaryRes?.data;
  const queue = queueRes?.data || [];
  const loading = payrollLoading || zkSummaryLoading;

  function refresh() {
    refetchSummary();
    refetchQueue();
  }

  async function runAction(action: () => Promise<unknown>, label: string) {
    setActionLoading(label);
    setActionError(null);
    try {
      await action();
      refresh();
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
          <h1 className="page-title">Zenta Verification Dashboard</h1>
          <p className="page-subtitle">Payroll commitments, real Groth16 proofs, and Stellar testnet registry verification.</p>
        </div>
      </div>

      {actionError && <div className="error-banner">{actionError}</div>}

      <div className="kpi-grid">
        <div className="kpi-card alert">
          <div className="kpi-label">Nominas Pendientes</div>
          <div className="kpi-value" style={{ fontSize: '22px' }}>
            {loading ? '-' : `$${payroll?.totalPending.toFixed(2) || '0.00'}`}
          </div>
          <div className="kpi-meta">{zkSummary?.pendingPayrolls || 0} payroll records with balance</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Pruebas ZK Generadas</div>
          <div className="kpi-value">{loading ? '-' : zkSummary?.generatedProofs || 0}</div>
          <div className="kpi-meta">Circom + Groth16 proofs</div>
        </div>
        <div className="kpi-card verified">
          <div className="kpi-label">Pruebas Verificadas Onchain</div>
          <div className="kpi-value">{loading ? '-' : zkSummary?.verifiedOnchain || 0}</div>
          <div className="kpi-meta">Stellar testnet registry</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Ultimo Commitment Hash</div>
          <div className="kpi-value hash-kpi">
            {zkSummary?.latestCommitmentHash ? shortHash(zkSummary.latestCommitmentHash) : 'None'}
          </div>
          <div className="kpi-meta">Poseidon commitment</div>
        </div>
      </div>

      <div className="table-container">
        <div className="table-header">
          <span className="table-title">Payroll Verification Queue</span>
          <span className="badge badge-proof-verified">REAL ZK</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Operator</th>
              <th>Period</th>
              <th className="text-right">Units</th>
              <th className="text-right">Payroll</th>
              <th>Commitment</th>
              <th>Status</th>
              <th className="text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {queueLoading ? (
              <tr><td colSpan={7} className="table-empty">Loading...</td></tr>
            ) : queue.length === 0 ? (
              <tr><td colSpan={7} className="table-empty">No payroll calculations yet.</td></tr>
            ) : (
              queue.slice(0, 8).map(item => (
                <QueueRow key={item.id} item={item} actionLoading={actionLoading} onAction={runAction} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function QueueRow({ item, actionLoading, onAction }: {
  item: ZkQueueItem;
  actionLoading: string | null;
  onAction: (action: () => Promise<unknown>, label: string) => void;
}) {
  const canCommit = !item.commitmentHash;
  const canProof = item.proofStatus === 'COMMITMENT_GENERATED';
  const canVerifyOffchain = item.proofStatus === 'GENERATED';
  const canRegisterStellar = item.proofStatus === 'OFFCHAIN_VERIFIED';
  const actionId = `${item.proofStatus}-${item.id}`;

  return (
    <tr>
      <td style={{ fontWeight: 600 }}>{item.operator?.displayName || 'Unknown'}</td>
      <td className="text-muted">{item.periodLabel}</td>
      <td className="text-right">{item.processedPairs}</td>
      <td className="text-right">${item.expectedPayment.toFixed(2)}</td>
      <td>
        {item.commitmentHash ? (
          <span className="hash-highlight" title={item.commitmentHash}>{shortHash(item.commitmentHash)}</span>
        ) : (
          <span className="text-muted">Not committed</span>
        )}
      </td>
      <td><ProofStatusBadge status={item.proofStatus} /></td>
      <td className="text-center">
        {canCommit && (
          <button className="btn btn-sm btn-secondary" disabled={actionLoading === actionId} onClick={() => onAction(() => zkApi.generateCommitment(item.id), actionId)}>
            {actionLoading === actionId ? 'Generating...' : 'Generar Commitment'}
          </button>
        )}
        {canProof && (
          <button className="btn btn-sm btn-secondary" disabled={actionLoading === actionId} onClick={() => onAction(() => zkApi.generateProof(item.id), actionId)}>
            {actionLoading === actionId ? 'Generating...' : 'Generar Proof'}
          </button>
        )}
        {canVerifyOffchain && (
          <button className="btn btn-sm btn-secondary" disabled={actionLoading === actionId} onClick={() => onAction(() => zkApi.verifyOffchain(item.id), actionId)}>
            {actionLoading === actionId ? 'Checking...' : 'Verificar Off-chain'}
          </button>
        )}
        {canRegisterStellar && (
          <button className="btn btn-sm btn-primary" disabled={actionLoading === actionId} onClick={() => onAction(() => zkApi.verifyOnStellar(item.id), actionId)}>
            {actionLoading === actionId ? 'Registering...' : 'Registrar Stellar'}
          </button>
        )}
        {!canCommit && !canProof && !canVerifyOffchain && !canRegisterStellar && <span className="text-muted text-xs">Ready</span>}
      </td>
    </tr>
  );
}

function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}
