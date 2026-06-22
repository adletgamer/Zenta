import { useApi } from '../hooks/useApi';
import { auditApi } from '../api/audit';
import { ProofStatusBadge } from '../components/Badges';
import { TableSkeleton } from '../components/Status';

const EVENT_COLORS: Record<string, string> = {
  LOT_CREATED: 'var(--color-primary-action)',
  LOT_ADVANCED: 'var(--color-warning)',
  LOT_COMPLETED: 'var(--color-success)',
  OPERATOR_ASSIGNED: 'var(--color-secondary)',
  PAYROLL_CALCULATED: 'var(--color-info)',
  PAYMENT_REGISTERED: 'var(--color-success)',
  COMMITMENT_GENERATED: '#c084fc',
  PROOF_GENERATED: 'var(--color-info)',
  PROOF_VERIFIED: 'var(--color-success)',
  STELLAR_SUBMITTED: '#60b4ff',
  RATE_UPDATED: 'var(--color-warning)',
};

const EVENT_LABELS: Record<string, string> = {
  LOT_CREATED: 'Lot Created', LOT_ADVANCED: 'Stage Advanced', LOT_COMPLETED: 'Lot Completed',
  OPERATOR_ASSIGNED: 'Operator Assigned', PAYROLL_CALCULATED: 'Payroll Calculated',
  PAYMENT_REGISTERED: 'Payment Registered', COMMITMENT_GENERATED: 'Commitment Generated',
  PROOF_GENERATED: 'Proof Generated', PROOF_VERIFIED: 'Proof Verified',
  STELLAR_SUBMITTED: 'Stellar Submitted', RATE_UPDATED: 'Rate Updated',
};

export function AuditLog() {
  const { data: auditRes, loading, error } = useApi(() => auditApi.list(100, 0));
  const events = auditRes?.data || [];
  const total = auditRes?.total || 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Log</h1>
          <p className="page-subtitle">Immutable record of all system events — {total} entries</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="table-container">
        <div className="table-header">
          <span className="table-title">Event Log</span>
          <span className="text-muted text-sm">{events.length} shown</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Event</th>
              <th>Entity</th>
              <th>Operator</th>
              <th>Lot</th>
              <th>Commitment Hash</th>
              <th>Proof Status</th>
              <th>Verification</th>
              <th>Metadata</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton columns={9} rows={8} />
            ) : events.length === 0 ? (
              <tr><td colSpan={9}><div className="table-empty"><p>No audit events yet.</p></div></td></tr>
            ) : events.map(event => (
              <tr key={event.id}>
                <td>
                  <span className="hash">{new Date(event.timestamp || event.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: EVENT_COLORS[event.eventType] || 'var(--color-on-surface-muted)', flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: EVENT_COLORS[event.eventType] || 'var(--color-on-surface)' }}>
                      {EVENT_LABELS[event.eventType] || event.eventType}
                    </span>
                  </div>
                </td>
                <td><span className="badge badge-stage-queue">{event.entityType}</span></td>
                <td className="text-muted">{event.operator?.displayName || '—'}</td>
                <td>
                  {event.productionLot ? (
                    <span className="text-mono" style={{ color: 'var(--color-primary-action)' }}>{event.productionLot.lotCode}</span>
                  ) : '—'}
                </td>
                <td>
                  {event.commitmentHash ? (
                    <span className="hash" title={event.commitmentHash}>{event.commitmentHash.substring(0, 20)}…</span>
                  ) : '—'}
                </td>
                <td>{event.proofStatus ? <ProofStatusBadge status={event.proofStatus} /> : 'â€”'}</td>
                <td><span className="hash">{event.verificationStatus || 'â€”'}</span></td>
                <td>
                  <span className="hash" style={{ fontSize: '10px' }}>
                    {Object.entries(event.metadata || {}).slice(0, 2).map(([k, v]) => `${k}=${v}`).join(', ')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
