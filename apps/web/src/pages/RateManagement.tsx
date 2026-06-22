import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { ratesApi, StageRate } from '../api/rates';
import { TableSkeleton, Toast } from '../components/Status';

const STAGE_LABELS: Record<string, { label: string; spanish: string; desc: string }> = {
  CUTTING:        { label: 'Cutting',        spanish: 'Corte',     desc: 'Leather and material cutting' },
  STITCHING:      { label: 'Stitching',      spanish: 'Aparado',   desc: 'Upper stitching and assembly' },
  ASSEMBLY:       { label: 'Assembly',       spanish: 'Armado',    desc: 'Upper to last assembly' },
  SOLE_ATTACHMENT:{ label: 'Sole Attachment',spanish: 'Ensuelado', desc: 'Sole attachment and bonding' },
  FINISHING:      { label: 'Finishing',      spanish: 'Acabado',   desc: 'Final finishing and QC' },
};

export function RateManagement() {
  const { data: ratesRes, loading, error, refetch } = useApi(() => ratesApi.list());
  const { data: historyRes, loading: historyLoading, refetch: refetchHistory } = useApi(() => ratesApi.history());
  const rates = ratesRes?.data || [];
  const history = historyRes?.data || [];
  const [editingStage, setEditingStage] = useState<string | null>(null);
  const [newRate, setNewRate] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function handleSave(stage: string) {
    setSaving(true); setSaveError(null);
    try {
      await ratesApi.update(stage, Number(newRate));
      setEditingStage(null);
      setToast('Rate updated');
      await Promise.all([refetch(), refetchHistory()]);
    } catch (err) { setSaveError((err as Error).message); }
    finally { setSaving(false); }
  }

  const totalPayroll = rates.reduce((s, r) => s + r.ratePerPair, 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Rate Management</h1>
          <p className="page-subtitle">Configure labor rates per production stage. Changes are versioned for audit integrity.</p>
        </div>
      </div>

      {saveError && <div className="error-banner">{saveError}</div>}
      {error && <div className="error-banner">{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {loading ? (
          Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="card" style={{ border: '1px solid var(--color-border)' }}>
              <div className="skeleton-line skeleton-label" style={{ marginBottom: '16px' }} />
              <div className="skeleton-line skeleton-value" style={{ width: '55%' }} />
            </div>
          ))
        ) : rates.map(rate => {
          const info = STAGE_LABELS[rate.stage] || { label: rate.stage, spanish: '', desc: '' };
          const isEditing = editingStage === rate.stage;
          return (
            <div key={rate.id} className="card" style={{ border: '1px solid var(--color-border)' }}>
              <div className="card-header">
                <div>
                  <div className="card-title">{info.spanish} <span className="text-muted" style={{ fontWeight: 400 }}>/ {info.label}</span></div>
                  <div className="card-subtitle">{info.desc}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', color: 'var(--color-on-surface-muted)', marginBottom: '2px' }}>v{rate.version}</div>
                  {!isEditing && (
                    <button className="btn btn-sm btn-ghost" disabled={saving} onClick={() => { setEditingStage(rate.stage); setNewRate(rate.ratePerPair.toString()); setSaveError(null); }}>Edit</button>
                  )}
                </div>
              </div>

              {isEditing ? (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                    <span style={{ color: 'var(--color-on-surface-muted)', fontSize: '20px' }}>$</span>
                    <input
                      type="number" step="0.01" min="0" className="form-input"
                      value={newRate} onChange={e => setNewRate(e.target.value)}
                      style={{ fontSize: '24px', fontWeight: 700 }}
                      autoFocus
                    />
                    <span className="text-muted text-sm">/pair</span>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => handleSave(rate.stage)} disabled={saving || Number(newRate) <= 0}>{saving ? 'Saving...' : 'Save'}</button>
                  <button className="btn btn-ghost btn-sm" disabled={saving} onClick={() => setEditingStage(null)}>Cancel</button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontSize: '36px', fontWeight: 700, color: 'var(--color-primary-action)' }}>${rate.ratePerPair.toFixed(2)}</span>
                  <span className="text-muted">/pair processed</span>
                </div>
              )}

              <div style={{ marginTop: '12px', display: 'flex', gap: '16px' }}>
                <div>
                  <div className="text-xs text-muted">Valid from</div>
                  <div style={{ fontSize: '12px' }}>{new Date(rate.validFrom).toLocaleDateString()}</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Last updated</div>
                  <div style={{ fontSize: '12px' }}>{new Date(rate.updatedAt).toLocaleDateString()}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="card-title" style={{ marginBottom: '16px' }}>Rate Summary</div>
        <table style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', fontSize: '11px', color: 'var(--color-on-surface-muted)', padding: '4px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Stage</th>
              <th style={{ textAlign: 'right', fontSize: '11px', color: 'var(--color-on-surface-muted)', padding: '4px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rate/Pair</th>
              <th style={{ textAlign: 'right', fontSize: '11px', color: 'var(--color-on-surface-muted)', padding: '4px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Version</th>
            </tr>
          </thead>
          <tbody>
            {rates.map(r => (
              <tr key={r.id}>
                <td style={{ padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>{STAGE_LABELS[r.stage]?.label || r.stage}</td>
                <td style={{ textAlign: 'right', padding: '8px 0', borderBottom: '1px solid var(--color-border)', fontWeight: 600, color: 'var(--color-primary-action)' }}>${r.ratePerPair.toFixed(2)}</td>
                <td style={{ textAlign: 'right', padding: '8px 0', borderBottom: '1px solid var(--color-border)', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-on-surface-muted)' }}>v{r.version}</td>
              </tr>
            ))}
            <tr>
              <td style={{ padding: '8px 0', fontWeight: 700 }}>Total (all stages)</td>
              <td style={{ textAlign: 'right', padding: '8px 0', fontWeight: 700, color: 'var(--color-on-surface)' }}>${totalPayroll.toFixed(2)}</td>
              <td />
            </tr>
          </tbody>
        </table>
        <div className="simulation-warning" style={{ marginTop: '16px' }}>
          ⚠ Rate changes create new versions. Historical payroll calculations reference their original rate and remain auditable.
        </div>
      </div>

      <div className="table-container" style={{ marginTop: '24px' }}>
        <div className="table-header">
          <span className="table-title">Rate History</span>
          <span className="text-muted text-sm">{history.length} changes</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Stage</th>
              <th className="text-right">Rate</th>
              <th className="text-right">Version</th>
            </tr>
          </thead>
          <tbody>
            {historyLoading ? (
              <TableSkeleton columns={4} rows={4} />
            ) : history.length === 0 ? (
              <tr><td colSpan={4}><div className="table-empty"><p>No rate changes recorded yet.</p></div></td></tr>
            ) : history.map(item => (
              <tr key={item.id}>
                <td><span className="hash">{new Date(item.timestamp).toLocaleString()}</span></td>
                <td>{STAGE_LABELS[item.metadata.stage || '']?.label || item.metadata.stage || '-'}</td>
                <td className="text-right font-bold">${Number(item.metadata.newRate || 0).toFixed(2)}</td>
                <td className="text-right"><span className="hash">v{item.metadata.version || '-'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
