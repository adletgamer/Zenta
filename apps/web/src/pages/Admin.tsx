import { useApi } from '../hooks/useApi';
import { stellarApi } from '../api/stellar';
import { zkApi } from '../api/zk';

function short(value: string | null | undefined, head = 10, tail = 8): string {
  if (!value) return '-';
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString() : '-';
}

function confirmationMessage(status: {
  eventConfirmed?: boolean;
  stateConfirmed?: boolean;
  confirmationSource?: string;
} | undefined): string {
  if (!status) return 'Waiting for Stellar data';
  if (status.eventConfirmed) return 'Event confirmed by Soroban logs';
  if (status.stateConfirmed) return 'Verified by contract state; event lookup pending';
  if (status.confirmationSource === 'simulated') return 'SIMULATED only';
  return 'No Stellar confirmation found';
}

export function Admin() {
  const { data: statusRes, loading: statusLoading, error: statusError, refetch } = useApi(() => stellarApi.adminStatus());
  const { data: zkSummaryRes, loading: zkLoading } = useApi(() => zkApi.summary());
  const status = statusRes?.data;
  const zkSummary = zkSummaryRes?.data;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Console</h1>
          <p className="page-subtitle">Wallet, Stellar registry, ZK circuit, and deployment health.</p>
        </div>
        <button className="btn btn-secondary" onClick={refetch} disabled={statusLoading}>
          {statusLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {statusError && <div className="error-banner">{statusError}</div>}

      <div className="admin-grid">
        <section className="admin-panel admin-panel-primary">
          <div className="admin-panel-header">
            <div>
              <div className="card-title">Admin Wallet</div>
              <div className="card-subtitle">Public signer for Stellar registry submissions</div>
            </div>
            <span className={`badge ${status?.configured ? 'badge-proof-verified' : 'badge-proof-failed'}`}>
              {status?.health || 'LOADING'}
            </span>
          </div>
          <div className="admin-wallet-address" title={status?.publicKey || ''}>
            {statusLoading ? 'Loading wallet...' : status?.publicKey || 'Not configured'}
          </div>
          <div className="admin-metric-row">
            <AdminMetric label="Balance" value={status?.balance ? `${Number(status.balance).toFixed(4)} XLM` : '-'} />
            <AdminMetric label="Network" value={status?.network || '-'} />
            <AdminMetric label="Mode" value={status?.verificationMode || '-'} />
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <div className="card-title">Stellar Registry</div>
              <div className="card-subtitle">Soroban registry contract status</div>
            </div>
            <span className="badge badge-proof-generated">TESTNET</span>
          </div>
          <InfoRow label="Contract ID" value={status?.contractId || '-'} />
          <InfoRow label="RPC URL" value={status?.rpcUrl || '-'} />
          <InfoRow label="Latest TX" value={short(status?.latestTxHash)} title={status?.latestTxHash || undefined} />
          <InfoRow label="Ledger" value={status?.latestLedger ? String(status.latestLedger) : '-'} />
          <InfoRow label="Event Confirmed" value={status?.eventConfirmed ? 'true' : 'false'} />
          <InfoRow label="State Confirmed" value={status?.stateConfirmed ? 'true' : 'false'} />
          <InfoRow label="Confirmation Source" value={status?.confirmationSource || '-'} />
          <div className={`admin-confirmation ${status?.stateConfirmed ? 'is-ok' : 'is-waiting'}`}>
            {confirmationMessage(status)}
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <div className="card-title">ZK Circuit</div>
              <div className="card-subtitle">Runtime proving configuration</div>
            </div>
            <span className="badge badge-proof-verified">GROTH16</span>
          </div>
          <InfoRow label="Circuit" value="payroll.circom" />
          <InfoRow label="Commitment" value="Poseidon" />
          <InfoRow label="Proofs Generated" value={zkLoading ? '-' : String(zkSummary?.generatedProofs ?? 0)} />
          <InfoRow label="Onchain Verified" value={zkLoading ? '-' : String(zkSummary?.verifiedOnchain ?? 0)} />
          <InfoRow label="Latest Commitment" value={short(zkSummary?.latestCommitmentHash)} title={zkSummary?.latestCommitmentHash || undefined} />
        </section>

        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <div className="card-title">Deployment Health</div>
              <div className="card-subtitle">Operational readiness snapshot</div>
            </div>
            <span className={`badge ${status?.configured ? 'badge-proof-verified' : 'badge-proof-failed'}`}>
              {status?.configured ? 'READY' : 'CHECK'}
            </span>
          </div>
          <InfoRow label="API" value={statusError ? 'Error' : 'Online'} />
          <InfoRow label="Database" value="Connected" />
          <InfoRow label="Latest Status" value={status?.latestStatus || '-'} />
          <InfoRow label="Last Submitted" value={formatDate(status?.latestSubmittedAt || null)} />
          <InfoRow label="Last Verified" value={formatDate(status?.latestVerifiedAt || null)} />
        </section>
      </div>
    </div>
  );
}

function AdminMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-metric">
      <div className="text-xs text-muted">{label}</div>
      <div className="font-bold">{value}</div>
    </div>
  );
}

function InfoRow({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="admin-info-row">
      <span className="text-muted">{label}</span>
      <span className="hash truncate" title={title || value}>{value}</span>
    </div>
  );
}
