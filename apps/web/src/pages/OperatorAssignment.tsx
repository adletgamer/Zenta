import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { operatorsApi, Operator } from '../api/operators';
import { lotsApi } from '../api/lots';
import { auditApi } from '../api/audit';
import { SpecializationBadge } from '../components/Badges';
import { TableSkeleton, Toast } from '../components/Status';

export function OperatorAssignment() {
  const { data: opsRes, loading, error, refetch } = useApi(() => operatorsApi.list());
  const { data: lotsRes, loading: lotsLoading, refetch: refetchLots } = useApi(() => lotsApi.list());
  const { data: auditRes, loading: auditLoading, refetch: refetchAudit } = useApi(() => auditApi.list(8, 0));
  const operators = opsRes?.data || [];
  const lots = (lotsRes?.data || []).filter(l => l.status === 'ACTIVE');
  const auditEvents = auditRes?.data || [];

  const [showCreate, setShowCreate] = useState(false);
  const [assigningOp, setAssigningOp] = useState<Operator | null>(null);
  const [creating, setCreating] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState({ displayName: '', specialization: 'CUTTING' });
  const [assignForm, setAssignForm] = useState({ productionLotId: '', processedPairs: 10 });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true); setActionError(null);
    try {
      await operatorsApi.create(createForm);
      setShowCreate(false);
      setToast('Operator added');
      await refetch();
    } catch (err) { setActionError((err as Error).message); }
    finally { setCreating(false); }
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!assigningOp) return;
    setAssigning(true); setActionError(null);
    try {
      await operatorsApi.assignLot(assigningOp.id, {
        productionLotId: assignForm.productionLotId,
        processedPairs: Number(assignForm.processedPairs),
      });
      setAssigningOp(null);
      setToast('Lot assigned');
      await Promise.all([refetch(), refetchLots(), refetchAudit()]);
    } catch (err) { setActionError((err as Error).message); }
    finally { setAssigning(false); }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Operator Assignment</h1>
          <p className="page-subtitle">Assign production lots and track operator productivity</p>
        </div>
        <button className="btn btn-primary" disabled={loading || creating} onClick={() => { setShowCreate(true); setActionError(null); }}>
          + Add Operator
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="table-container">
        <div className="table-header">
          <span className="table-title">Operators</span>
          <span className="text-muted text-sm">{operators.length} operators</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Operator</th>
              <th>Code</th>
              <th>Specialization</th>
              <th className="text-right">Pairs Processed</th>
              <th className="text-right">Tasks Done</th>
              <th className="text-right">Active</th>
              <th className="text-right">Total Earned</th>
              <th className="text-right">Pending</th>
              <th className="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton columns={9} rows={6} />
            ) : operators.length === 0 ? (
              <tr><td colSpan={9}><div className="table-empty"><p>No operators yet.</p></div></td></tr>
            ) : operators.map(op => (
              <tr key={op.id}>
                <td style={{ fontWeight: 600 }}>{op.displayName}</td>
                <td><span className="hash">{op.pseudonymousCode}</span></td>
                <td><SpecializationBadge spec={op.specialization} /></td>
                <td className="text-right">{op.totalProcessedPairs}</td>
                <td className="text-right">{op.totalTasksCompleted}</td>
                <td className="text-right">
                  <span style={{ color: op.activeAssignments > 0 ? 'var(--color-warning)' : 'var(--color-on-surface-muted)' }}>
                    {op.activeAssignments}
                  </span>
                </td>
                <td className="text-right text-success">${op.totalEarned.toFixed(2)}</td>
                <td className="text-right">
                  <span style={{ color: op.pendingBalance > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                    ${op.pendingBalance.toFixed(2)}
                  </span>
                </td>
                <td className="text-center">
                  <button className="btn btn-sm btn-secondary" disabled={assigning || lotsLoading} onClick={() => { setAssigningOp(op); setAssignForm({ productionLotId: '', processedPairs: 10 }); setActionError(null); }}>
                    Assign Lot
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="table-container" style={{ marginTop: '24px' }}>
        <div className="table-header">
          <span className="table-title">Recent Assignment Audit</span>
          <span className="text-muted text-sm">{auditEvents.length} records</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Event</th>
              <th>Operator</th>
              <th>Lot</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {auditLoading ? (
              <TableSkeleton columns={5} rows={4} />
            ) : auditEvents.length === 0 ? (
              <tr><td colSpan={5}><div className="table-empty"><p>No audit records yet.</p></div></td></tr>
            ) : auditEvents.map(event => (
              <tr key={event.id}>
                <td><span className="hash">{new Date(event.createdAt).toLocaleString()}</span></td>
                <td style={{ fontWeight: 600 }}>{event.eventType.replace(/_/g, ' ')}</td>
                <td className="text-muted">{event.operator?.displayName || '-'}</td>
                <td>{event.productionLot?.lotCode || '-'}</td>
                <td><span className="hash">{Object.entries(event.metadata || {}).slice(0, 3).map(([k, v]) => `${k}=${v}`).join(', ') || '-'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Operator Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="modal">
            <h2 className="modal-title">Add Operator</h2>
            {actionError && <div className="error-banner">{actionError}</div>}
            <form className="modal-form" onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-input" value={createForm.displayName} onChange={e => setCreateForm(f => ({ ...f, displayName: e.target.value }))} placeholder="Carlos Mendoza" required />
              </div>
              <div className="form-group">
                <label className="form-label">Specialization</label>
                <select className="form-select" value={createForm.specialization} onChange={e => setCreateForm(f => ({ ...f, specialization: e.target.value }))}>
                  <option value="CUTTING">Corte (Cutting)</option>
                  <option value="STITCHING">Aparado (Stitching)</option>
                  <option value="ASSEMBLY">Armado (Assembly)</option>
                  <option value="SOLE_ATTACHMENT">Ensuelado (Sole Attachment)</option>
                  <option value="FINISHING">Acabado (Finishing)</option>
                </select>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>{creating ? 'Creating…' : 'Add Operator'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Lot Modal */}
      {assigningOp && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setAssigningOp(null)}>
          <div className="modal">
            <h2 className="modal-title">Assign Lot to {assigningOp.displayName}</h2>
            {actionError && <div className="error-banner">{actionError}</div>}
            <form className="modal-form" onSubmit={handleAssign}>
              <div className="form-group">
                <label className="form-label">Production Lot</label>
                <select className="form-select" value={assignForm.productionLotId} onChange={e => setAssignForm(f => ({ ...f, productionLotId: e.target.value }))} required>
                  <option value="">Select a lot…</option>
                  {lots.map(lot => (
                    <option key={lot.id} value={lot.id}>{lot.lotCode} — {lot.model} ({lot.currentStage.replace('_',' ')})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Processed Pairs</label>
                <input type="number" className="form-input" value={assignForm.processedPairs} min={0} onChange={e => setAssignForm(f => ({ ...f, processedPairs: Number(e.target.value) }))} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setAssigningOp(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={assigning || !assignForm.productionLotId}>
                  {assigning ? 'Assigning…' : 'Assign'}
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
