type ToastTone = 'success' | 'error';

export function Toast({ message, tone = 'success', onClose }: { message: string; tone?: ToastTone; onClose: () => void }) {
  return (
    <div className={`toast toast-${tone}`} role="status">
      <span>{message}</span>
      <button type="button" className="toast-close" onClick={onClose} aria-label="Dismiss notification">
        x
      </button>
    </div>
  );
}

export function TableSkeleton({ columns, rows = 5 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, row) => (
        <tr key={row} className="skeleton-row">
          {Array.from({ length: columns }).map((__, col) => (
            <td key={col}>
              <div className="skeleton-line" style={{ width: `${col % 3 === 0 ? 72 : col % 3 === 1 ? 56 : 88}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function KpiSkeleton() {
  return (
    <div className="kpi-skeleton">
      <div className="skeleton-line skeleton-label" />
      <div className="skeleton-line skeleton-value" />
    </div>
  );
}
