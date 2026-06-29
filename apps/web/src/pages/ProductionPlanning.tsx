import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { lotsApi, Lot } from '../api/lots';
import { operatorsApi } from '../api/operators';
import { StageBadge, PriorityBadge } from '../components/Badges';
import { KpiSkeleton, TableSkeleton, Toast } from '../components/Status';

export function ProductionPlanning() {
  const { data: lotsRes, loading, error, refetch } = useApi(() => lotsApi.list());
  const { data: operatorsRes, loading: operatorsLoading } = useApi(() => operatorsApi.list());
  const lots = lotsRes?.data || [];
  const operators = operatorsRes?.data || [];
  const [showModal, setShowModal] = useState(false);
  const [advancingLot, setAdvancingLot] = useState<Lot | null>(null);
  const [creating, setCreating] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [form, setForm] = useState({
    lotCode: '', plannedDate: new Date().toISOString().split('T')[0],
    model: 'Veloce-X', color: 'Negro', priority: 'NORMAL',
    sizeCurve: 'Standard', totalPairs: 15,
    estimatedMaterial: 450, estimatedLaborHours: 12,
  });

  const [advanceForm, setAdvanceForm] = useState({ operatorId: '', processedPairs: 0, notes: '' });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setActionError(null);
    try {
      await lotsApi.create({ ...form, totalPairs: Number(form.totalPairs) });
      setShowModal(false);
      setToast('Production lot created');
      await refetch();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function handleAdvance(e: React.FormEvent) {
    e.preventDefault();
    if (!advancingLot) return;
    setAdvancing(true);
    setActionError(null);
    try {
      await lotsApi.advance(advancingLot.id, {
        operatorId: advanceForm.operatorId,
        processedPairs: Number(advanceForm.processedPairs),
        notes: advanceForm.notes,
      });
      setAdvancingLot(null);
      setToast('Lot advanced successfully');
      await refetch();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setAdvancing(false);
    }
  }

  const STAGE_ORDER = ['QUEUE','CUTTING','STITCHING','ASSEMBLY','SOLE_ATTACHMENT','FINISHING','COMPLETED'];
  const getNextStage = (stage: string) => STAGE_ORDER[STAGE_ORDER.indexOf(stage) + 1] || 'COMPLETED';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Production Planning</h1>
          <p className="page-subtitle">Manage production lots through manufacturing stages</p>
        </div>
        <button className="btn btn-primary" disabled={loading || creating} onClick={() => { setShowModal(true); setActionError(null); }}>
          + New Lot
        </button>
      </div>

      {/* Stats */}
      <div className="kpi-grid" style={{ marginBottom: '24px' }}>
        {['QUEUE','CUTTING','STITCHING','ASSEMBLY','SOLE_ATTACHMENT','FINISHING'].map(stage => {
          const count = lots.filter(l => l.currentStage === stage && l.status === 'ACTIVE').length;
          return (
            <div key={stage} className="kpi-card" style={{ padding: '16px' }}>
              {loading ? <KpiSkeleton /> : (
                <>
                  <div className="kpi-label" style={{ fontSize: '10px' }}>{stage.replace('_', ' ')}</div>
                  <div className="kpi-value" style={{ fontSize: '24px' }}>{count}</div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="table-container">
        <div className="table-header">
          <span className="table-title">All Production Lots</span>
          <span className="text-muted text-sm">{lots.length} lots</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Lot Code</th>
              <th>Model</th>
              <th>Color</th>
              <th>Priority</th>
              <th>Stage</th>
              <th className="text-right">Pairs</th>
              <th className="text-right">Mat. Cost</th>
              <th>Planned Date</th>
              <th className="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton columns={9} rows={6} />
            ) : lots.length === 0 ? (
              <tr><td colSpan={9}><div className="table-empty"><div className="table-empty-icon">◈</div><p>No lots yet. Create your first production lot.</p></div></td></tr>
            ) : lots.map(lot => (
              <tr key={lot.id}>
                <td>
                  <span className="text-mono" style={{ color: 'var(--color-primary-action)', fontWeight: 700 }}>{lot.lotCode}</span>
                </td>
                <td style={{ fontWeight: 500 }}>{lot.model}</td>
                <td className="text-muted">{lot.color}</td>
                <td><PriorityBadge priority={lot.priority} /></td>
                <td><StageBadge stage={lot.currentStage} /></td>
                <td className="text-right">{lot.totalPairs}</td>
                <td className="text-right">${lot.estimatedMaterial.toFixed(0)}</td>
                <td className="text-muted">{new Date(lot.plannedDate).toLocaleDateString()}</td>
                <td className="text-center">
                  {lot.status !== 'COMPLETED' && lot.status !== 'CANCELLED' && (
                    <button
                      className="btn btn-sm btn-secondary"
                      disabled={advancing}
                      onClick={() => { setAdvancingLot(lot); setAdvanceForm({ operatorId: '', processedPairs: lot.totalPairs, notes: '' }); setActionError(null); }}
                    >
                      Advance → {getNextStage(lot.currentStage).replace('_',' ')}
                    </button>
                  )}
                  {lot.status === 'COMPLETED' && <span className="badge badge-stage-completed">Done</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Lot Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <h2 className="modal-title">Create Production Lot</h2>
            {actionError && <div className="error-banner">{actionError}</div>}
            <form className="modal-form" onSubmit={handleCreate}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Lot Code</label>
                  <input className="form-input" value={form.lotCode} onChange={e => setForm(f => ({ ...f, lotCode: e.target.value }))} placeholder="OP-006" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Planned Date</label>
                  <input type="date" className="form-input" value={form.plannedDate} onChange={e => setForm(f => ({ ...f, plannedDate: e.target.value }))} required />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Model</label>
                  <select className="form-select" value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))}>
                    <option>Veloce-X</option>
                    <option>Titan B-90</option>
                    <option>Urbano Neo</option>
                    <option>Augusto S-10</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Color</label>
                  <input className="form-input" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} placeholder="Negro" required />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select className="form-select" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                    <option value="LOW">Low</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Total Pairs</label>
                  <input type="number" className="form-input" value={form.totalPairs} min={1} onChange={e => setForm(f => ({ ...f, totalPairs: Number(e.target.value) }))} required />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Est. Material ($)</label>
                  <input type="number" className="form-input" value={form.estimatedMaterial} onChange={e => setForm(f => ({ ...f, estimatedMaterial: Number(e.target.value) }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Est. Labor Hours</label>
                  <input type="number" className="form-input" value={form.estimatedLaborHours} onChange={e => setForm(f => ({ ...f, estimatedLaborHours: Number(e.target.value) }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? 'Creating…' : 'Create Lot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Advance Stage Modal */}
      {advancingLot && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setAdvancingLot(null)}>
          <div className="modal">
            <h2 className="modal-title">Advance Lot {advancingLot.lotCode}</h2>
            <p className="text-muted" style={{ marginBottom: '20px', fontSize: '13px' }}>
              Moving from <strong style={{ color: 'var(--color-on-surface)' }}>{advancingLot.currentStage.replace('_',' ')}</strong>
              {' '}→ <strong style={{ color: 'var(--color-primary-action)' }}>{getNextStage(advancingLot.currentStage).replace('_',' ')}</strong>
            </p>
            {actionError && <div className="error-banner">{actionError}</div>}
            <form className="modal-form" onSubmit={handleAdvance}>
              <div className="form-group">
                <label className="form-label">Operator</label>
                <select
                  className="form-select"
                  value={advanceForm.operatorId}
                  onChange={e => setAdvanceForm(f => ({ ...f, operatorId: e.target.value }))}
                  required
                >
                  <option value="">Select operator...</option>
                  {operators.map(operator => (
                    <option key={operator.id} value={operator.id}>
                      {operator.displayName} - {operator.specialization.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Processed Pairs</label>
                <input type="number" className="form-input" value={advanceForm.processedPairs} min={0} max={advancingLot.totalPairs}
                  onChange={e => setAdvanceForm(f => ({ ...f, processedPairs: Number(e.target.value) }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Notes (optional)</label>
                <input className="form-input" value={advanceForm.notes}
                  onChange={e => setAdvanceForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any observations…" />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setAdvancingLot(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={advancing || operatorsLoading || !advanceForm.operatorId}>
                  {advancing ? 'Advancing…' : 'Advance Stage'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
