import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { payrollApi, PayrollCalc } from '../api/payroll';
import { operatorsApi } from '../api/operators';
import { ProofStatusBadge, PaymentMethodBadge } from '../components/Badges';
import { KpiSkeleton, TableSkeleton, Toast } from '../components/Status';

export function WeeklyPayroll() {
  const { data: summaryRes, loading: summaryLoading, error: summaryError, refetch: refetchSummary } = useApi(() => payrollApi.summary());
  const { data: calcsRes, loading: calcsLoading, error: calcsError, refetch: refetchCalcs } = useApi(() => payrollApi.operators());
  const { data: opsRes, loading: opsLoading } = useApi(() => operatorsApi.list());

  const summary = summaryRes?.data;
  const calcs = calcsRes?.data || [];
  const operators = opsRes?.data || [];

  const [showCalculate, setShowCalculate] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [selectedCalc, setSelectedCalc] = useState<PayrollCalc | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [payingLoading, setPayingLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const today = new Date();
  const weekStart = new Date(today); weekStart.setDate(today.getDate() - today.getDay() + 1);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);

  const [calcForm, setCalcForm] = useState({
    operatorId: '',
    periodLabel: 'Week 1 - June 2025',
    periodStart: weekStart.toISOString().split('T')[0],
    periodEnd: weekEnd.toISOString().split('T')[0],
    bonus: 0, penalty: 0,
  });

  const [payForm, setPayForm] = useState({ amount: 0, method: 'CASH', reference: '', notes: '' });

  function refetch() { refetchSummary(); refetchCalcs(); }

  async function handleCalculate(e: React.FormEvent) {
    e.preventDefault();
    setCalculating(true); setActionError(null);
    try {
      await payrollApi.calculate(calcForm);
      setShowCalculate(false);
      setToast('Payroll calculated');
      refetch();
    } catch (err) { setActionError((err as Error).message); }
    finally { setCalculating(false); }
  }

  async function handlePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCalc) return;
    setPayingLoading(true); setActionError(null);
    try {
      await payrollApi.registerPayment({
        operatorId: selectedCalc.operatorId,
        payrollCalculationId: selectedCalc.id,
        amount: Number(payForm.amount),
        method: payForm.method,
        reference: payForm.reference,
        notes: payForm.notes,
      });
      setShowPayment(false); setSelectedCalc(null);
      setToast('Payment registered');
      refetch();
    } catch (err) { setActionError((err as Error).message); }
    finally { setPayingLoading(false); }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Weekly Payroll</h1>
          <p className="page-subtitle">Calculate and manage operator earnings · {summary?.periodLabel}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" disabled={opsLoading || calculating} onClick={() => { setShowCalculate(true); setActionError(null); }}>Calculate Payroll</button>
        </div>
      </div>

      {(summaryError || calcsError) && <div className="error-banner">{summaryError || calcsError}</div>}

      {/* Summary KPIs */}
      <div className="kpi-grid" style={{ marginBottom: '24px' }}>
        <div className="kpi-card orange">
          {summaryLoading ? <KpiSkeleton /> : (
            <>
              <div className="kpi-label">Total Earned</div>
              <div className="kpi-value" style={{ fontSize: '22px' }}>${summary?.totalEarned.toFixed(2)}</div>
              <div className="kpi-meta">{summary?.totalPairs} pairs</div>
            </>
          )}
        </div>
        <div className="kpi-card green">
          {summaryLoading ? <KpiSkeleton /> : (
            <>
              <div className="kpi-label">Total Paid</div>
              <div className="kpi-value" style={{ fontSize: '22px' }}>${summary?.totalPaid.toFixed(2)}</div>
            </>
          )}
        </div>
        <div className="kpi-card yellow">
          {summaryLoading ? <KpiSkeleton /> : (
            <>
              <div className="kpi-label">Pending Balance</div>
              <div className="kpi-value" style={{ fontSize: '22px' }}>${summary?.totalPending.toFixed(2)}</div>
            </>
          )}
        </div>
        <div className="kpi-card purple">
          {summaryLoading ? <KpiSkeleton /> : (
            <>
              <div className="kpi-label">ZK Verified</div>
              <div className="kpi-value">{summary?.verifiedPayrolls}</div>
            </>
          )}
        </div>
      </div>

      <div className="table-container">
        <div className="table-header">
          <span className="table-title">Operator Payroll</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Operator</th>
              <th>Specialization</th>
              <th>Period</th>
              <th className="text-right">Pairs</th>
              <th className="text-right">Rate</th>
              <th className="text-right">Earned</th>
              <th className="text-right">Paid</th>
              <th className="text-right">Pending</th>
              <th>ZK Status</th>
              <th className="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {calcsLoading ? (
              <TableSkeleton columns={10} rows={6} />
            ) : calcs.length === 0 ? (
              <tr><td colSpan={10}><div className="table-empty"><p>No payroll calculations yet.</p></div></td></tr>
            ) : calcs.map(calc => (
              <tr key={calc.id}>
                <td style={{ fontWeight: 600 }}>{calc.operator?.displayName}</td>
                <td><span className="badge badge-stage-queue">{calc.operator?.specialization?.replace('_',' ')}</span></td>
                <td className="text-muted">{calc.periodLabel}</td>
                <td className="text-right">{calc.processedPairs}</td>
                <td className="text-right text-mono">${calc.ratePerPair.toFixed(2)}</td>
                <td className="text-right font-bold">${calc.expectedPayment.toFixed(2)}</td>
                <td className="text-right text-success">${calc.paidAmount.toFixed(2)}</td>
                <td className="text-right">
                  <span style={{ color: calc.pendingBalance > 0 ? 'var(--color-warning)' : 'var(--color-success)', fontWeight: 600 }}>
                    ${calc.pendingBalance.toFixed(2)}
                  </span>
                </td>
                <td><ProofStatusBadge status={calc.proofStatus} /></td>
                <td className="text-center">
                  {calc.pendingBalance > 0 && (
                    <button className="btn btn-sm btn-primary" disabled={payingLoading} onClick={() => { setSelectedCalc(calc); setPayForm({ amount: calc.pendingBalance, method: 'CASH', reference: '', notes: '' }); setShowPayment(true); setActionError(null); }}>
                      Pay
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Calculate Modal */}
      {showCalculate && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCalculate(false)}>
          <div className="modal">
            <h2 className="modal-title">Calculate Payroll</h2>
            {actionError && <div className="error-banner">{actionError}</div>}
            <form className="modal-form" onSubmit={handleCalculate}>
              <div className="form-group">
                <label className="form-label">Operator</label>
                <select className="form-select" value={calcForm.operatorId} onChange={e => setCalcForm(f => ({ ...f, operatorId: e.target.value }))} required>
                  <option value="">Select operator…</option>
                  {operators.map(op => <option key={op.id} value={op.id}>{op.displayName}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Period Label</label>
                <input className="form-input" value={calcForm.periodLabel} onChange={e => setCalcForm(f => ({ ...f, periodLabel: e.target.value }))} />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Period Start</label>
                  <input type="date" className="form-input" value={calcForm.periodStart} onChange={e => setCalcForm(f => ({ ...f, periodStart: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Period End</label>
                  <input type="date" className="form-input" value={calcForm.periodEnd} onChange={e => setCalcForm(f => ({ ...f, periodEnd: e.target.value }))} />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Bonus ($)</label>
                  <input type="number" step="0.01" className="form-input" value={calcForm.bonus} onChange={e => setCalcForm(f => ({ ...f, bonus: Number(e.target.value) }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Penalty ($)</label>
                  <input type="number" step="0.01" className="form-input" value={calcForm.penalty} onChange={e => setCalcForm(f => ({ ...f, penalty: Number(e.target.value) }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowCalculate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={calculating || !calcForm.operatorId}>{calculating ? 'Calculating...' : 'Calculate'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPayment && selectedCalc && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowPayment(false)}>
          <div className="modal">
            <h2 className="modal-title">Register Payment</h2>
            <p className="text-muted" style={{ marginBottom: '16px', fontSize: '13px' }}>For {selectedCalc.operator?.displayName} · {selectedCalc.periodLabel}</p>
            {actionError && <div className="error-banner">{actionError}</div>}
            <form className="modal-form" onSubmit={handlePayment}>
              <div className="form-group">
                <label className="form-label">Amount ($)</label>
                <input type="number" step="0.01" className="form-input" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: Number(e.target.value) }))} max={selectedCalc.pendingBalance} required />
              </div>
              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <select className="form-select" value={payForm.method} onChange={e => setPayForm(f => ({ ...f, method: e.target.value }))}>
                  <option value="CASH">Cash</option>
                  <option value="TRANSFER">Bank Transfer</option>
                  <option value="VOUCHER">Voucher</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Reference</label>
                <input className="form-input" value={payForm.reference} onChange={e => setPayForm(f => ({ ...f, reference: e.target.value }))} placeholder="PAY-001" />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => { setShowPayment(false); setSelectedCalc(null); }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={payingLoading || Number(payForm.amount) <= 0}>{payingLoading ? 'Processing...' : 'Register Payment'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
