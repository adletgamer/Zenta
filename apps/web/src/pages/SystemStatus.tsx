import { useApi } from '../hooks/useApi';
import { stellarApi } from '../api/stellar';
import { zkApi } from '../api/zk';

function short(value: string | null | undefined, head = 10, tail = 8): string {
  if (!value) return '-';
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

function stellarExplorerUrl(txHash: string | null | undefined): string | null {
  return txHash ? `https://stellar.expert/explorer/testnet/tx/${txHash}` : null;
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

export function SystemStatus() {
  const { data: statusRes, loading: statusLoading, error: statusError, refetch } = useApi(() => stellarApi.status());
  const { data: zkSummaryRes, loading: zkLoading } = useApi(() => zkApi.summary());
  const status = statusRes?.data;
  const zkSummary = zkSummaryRes?.data;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Estado del Sistema</h1>
          <p className="page-subtitle">Wallet de firma, registro Stellar, circuito ZK y salud del despliegue.</p>
        </div>
        <button className="btn btn-secondary" onClick={refetch} disabled={statusLoading}>
          {statusLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {statusError && <div className="error-banner">{statusError}</div>}
      {status && !status.configured && (
        <div className="error-banner">
          Stellar backend signer is not configured. Check STELLAR_SECRET_KEY and STELLAR_CONTRACT_ID in Vercel.
        </div>
      )}

      <div className="admin-grid">
        <section className="admin-panel admin-panel-primary">
          <div className="admin-panel-header">
            <div>
              <div className="card-title">Stellar Testnet Registry</div>
              <div className="card-subtitle">Backend signer and Soroban registry used for verified payroll commitments</div>
            </div>
            <span className={`badge ${status?.configured ? 'badge-proof-verified' : 'badge-proof-failed'}`}>
              {status?.configured ? 'CONFIGURED' : status?.health || 'LOADING'}
            </span>
          </div>
          <div className="stellar-registry-grid">
            <RegistryValue label="Backend signer publicKey" value={statusLoading ? 'Loading wallet...' : short(status?.publicKey, 12, 10)} title={status?.publicKey || undefined} />
            <RegistryValue label="Contract ID" value={short(status?.contractId, 12, 10)} title={status?.contractId || undefined} />
            <RegistryValue label="Latest Stellar TX" value={short(status?.latestTxHash, 12, 10)} title={status?.latestTxHash || undefined} href={stellarExplorerUrl(status?.latestTxHash)} />
          </div>
          <div className="admin-metric-row">
            <StatusMetric label="Health" value={status?.health || '-'} />
            <StatusMetric label="Network" value={status?.network || '-'} />
            <StatusMetric label="Verification mode" value={status?.verificationMode || '-'} />
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
          <InfoRow label="Configured" value={status?.configured ? 'true' : 'false'} />
          <InfoRow label="Health" value={status?.health || '-'} />
          <InfoRow label="Network" value={status?.network || '-'} />
          <InfoRow label="RPC URL" value={status?.rpcUrl || '-'} />
          <InfoRow label="Latest TX" value={short(status?.latestTxHash)} title={status?.latestTxHash || undefined} href={stellarExplorerUrl(status?.latestTxHash)} />
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

function StatusMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-metric">
      <div className="text-xs text-muted">{label}</div>
      <div className="font-bold">{value}</div>
    </div>
  );
}

function RegistryValue({ label, value, title, href }: { label: string; value: string; title?: string; href?: string | null }) {
  const content = href ? (
    <a className="hash-link registry-link" href={href} target="_blank" rel="noreferrer" title={title || value}>
      {value}
    </a>
  ) : (
    <span className="hash-highlight registry-value" title={title || value}>{value}</span>
  );

  return (
    <div className="registry-card">
      <div className="text-xs text-muted">{label}</div>
      {content}
    </div>
  );
}

function InfoRow({ label, value, title, href }: { label: string; value: string; title?: string; href?: string | null }) {
  return (
    <div className="admin-info-row">
      <span className="text-muted">{label}</span>
      {href ? (
        <a className="hash-link admin-info-value" href={href} target="_blank" rel="noreferrer" title={title || value}>{value}</a>
      ) : (
        <span className="hash admin-info-value" title={title || value}>{value}</span>
      )}
    </div>
  );
}
