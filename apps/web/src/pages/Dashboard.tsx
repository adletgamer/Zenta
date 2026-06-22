import { useApi } from '../hooks/useApi';
import { payrollApi } from '../api/payroll';
import { lotsApi } from '../api/lots';
import { auditApi } from '../api/audit';

export function Dashboard() {
  const { data: summaryRes, loading: summaryLoading } = useApi(() => payrollApi.summary());
  const { data: lotsRes, loading: lotsLoading } = useApi(() => lotsApi.list());
  const { data: auditRes, loading: auditLoading } = useApi(() => auditApi.list(8, 0));

  const summary = summaryRes?.data;
  const lots = lotsRes?.data || [];
  const auditEvents = auditRes?.data || [];

  const activeLots = lots.filter(l => l.status === 'ACTIVE').length;
  const completedLots = lots.filter(l => l.status === 'COMPLETED').length;
  const urgentLots = lots.filter(l => l.priority === 'URGENT').length;

  const EVENT_LABELS: Record<string, string> = {
    LOT_CREATED: 'Lot Created', LOT_ADVANCED: 'Stage Advanced', LOT_COMPLETED: 'Lot Completed',
    OPERATOR_ASSIGNED: 'Operator Assigned', PAYROLL_CALCULATED: 'Payroll Calculated',
    PAYMENT_REGISTERED: 'Payment Registered', COMMITMENT_GENERATED: 'Commitment Generated',
    PROOF_GENERATED: 'Proof Generated', PROOF_VERIFIED: 'Proof Verified',
    STELLAR_SUBMITTED: 'Stellar Submitted', RATE_UPDATED: 'Rate Updated',
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Operations Dashboard</h1>
          <p className="page-subtitle">Real-time overview of CalzaPro manufacturing operations</p>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="kpi-grid">
        <div className="kpi-card orange">
          <div className="kpi-label">Active Lots</div>
          <div className="kpi-value">{lotsLoading ? '—' : activeLots}</div>
          <div className="kpi-meta">{urgentLots} urgent priority</div>
        </div>
        <div className="kpi-card blue">
          <div className="kpi-label">Completed Lots</div>
          <div className="kpi-value">{lotsLoading ? '—' : completedLots}</div>
          <div className="kpi-meta">This period</div>
        </div>
        <div className="kpi-card green">
          <div className="kpi-label">Total Earned</div>
          <div className="kpi-value" style={{ fontSize: '22px' }}>
            {summaryLoading ? '—' : `$${summary?.totalEarned.toFixed(2) || '0.00'}`}
          </div>
          <div className="kpi-meta">{summary?.totalPairs || 0} pairs processed</div>
        </div>
        <div className="kpi-card yellow">
          <div className="kpi-label">Pending Balance</div>
          <div className="kpi-value" style={{ fontSize: '22px' }}>
            {summaryLoading ? '—' : `$${summary?.totalPending.toFixed(2) || '0.00'}`}
          </div>
          <div className="kpi-meta">Across {summary?.totalOperators || 0} operators</div>
        </div>
        <div className="kpi-card purple">
          <div className="kpi-label">ZK Verified</div>
          <div className="kpi-value">{summaryLoading ? '—' : summary?.verifiedPayrolls || 0}</div>
          <div className="kpi-meta">Payrolls verified</div>
        </div>
      </div>

      <div className="grid-2">
        {/* Active Lots Table */}
        <div className="table-container">
          <div className="table-header">
            <span className="table-title">Active Production Lots</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Lot</th>
                <th>Model</th>
                <th>Stage</th>
                <th className="text-right">Pairs</th>
              </tr>
            </thead>
            <tbody>
              {lotsLoading ? (
                <tr><td colSpan={4} className="table-empty">Loading…</td></tr>
              ) : lots.filter(l => l.status === 'ACTIVE').slice(0, 6).map(lot => (
                <tr key={lot.id}>
                  <td className="text-mono" style={{ color: 'var(--color-primary-action)' }}>{lot.lotCode}</td>
                  <td>{lot.model}</td>
                  <td>
                    <StageBadge stage={lot.currentStage} />
                  </td>
                  <td className="text-right">{lot.totalPairs}</td>
                </tr>
              ))}
              {!lotsLoading && lots.filter(l => l.status === 'ACTIVE').length === 0 && (
                <tr><td colSpan={4} className="table-empty">No active lots</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Audit Feed */}
        <div className="table-container">
          <div className="table-header">
            <span className="table-title">Recent Activity</span>
          </div>
          {auditLoading ? (
            <div className="table-empty">Loading…</div>
          ) : (
            <div style={{ padding: '8px 0' }}>
              {auditEvents.slice(0, 8).map(event => (
                <div key={event.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '12px',
                  padding: '8px 20px', borderBottom: '1px solid var(--color-border)'
                }}>
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: getEventColor(event.eventType),
                    marginTop: '6px', flexShrink: 0
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', color: 'var(--color-on-surface)' }}>
                      {EVENT_LABELS[event.eventType] || event.eventType}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-on-surface-muted)', marginTop: '2px' }}>
                      {event.operator?.displayName || event.productionLot?.lotCode || event.entityType}
                      {' · '}
                      {new Date(event.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StageBadge({ stage }: { stage: string }) {
  const map: Record<string, { label: string; color: string }> = {
    QUEUE: { label: 'Queue', color: 'var(--color-stage-queue)' },
    CUTTING: { label: 'Cutting', color: 'var(--color-stage-cutting)' },
    STITCHING: { label: 'Stitching', color: 'var(--color-stage-stitching)' },
    ASSEMBLY: { label: 'Assembly', color: 'var(--color-stage-assembly)' },
    SOLE_ATTACHMENT: { label: 'Sole Attach', color: 'var(--color-stage-sole)' },
    FINISHING: { label: 'Finishing', color: 'var(--color-stage-finishing)' },
    COMPLETED: { label: 'Completed', color: 'var(--color-stage-completed)' },
  };
  const info = map[stage] || { label: stage, color: 'var(--color-on-surface-muted)' };
  return (
    <span style={{
      fontSize: '11px', fontWeight: 700, color: info.color,
      background: info.color + '1a', border: `1px solid ${info.color}4d`,
      padding: '2px 8px', borderRadius: '2px', textTransform: 'uppercase', letterSpacing: '0.04em'
    }}>{info.label}</span>
  );
}

function getEventColor(type: string): string {
  if (type.includes('PROOF') || type.includes('STELLAR') || type.includes('COMMIT')) return 'var(--color-info)';
  if (type.includes('PAYMENT')) return 'var(--color-success)';
  if (type.includes('PAYROLL')) return 'var(--color-warning)';
  if (type.includes('LOT')) return 'var(--color-primary-action)';
  return 'var(--color-on-surface-muted)';
}
