import { NavLink, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  { path: '/', label: 'Produccion', icon: 'P', exact: true },
  { path: '/operators', label: 'Empleados', icon: 'E' },
  { path: '/payroll', label: 'Nomina', icon: 'N' },
  { path: '/zk', label: 'Auditoria ZK', icon: 'ZK' },
];

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/production': 'Produccion',
  '/operators': 'Empleados',
  '/rates': 'Empleados',
  '/payroll': 'Nomina',
  '/audit': 'Audit Log',
  '/zk': 'ZK Verification Center',
};

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const pageTitle = PAGE_TITLES[location.pathname] || 'Zenta ERP';
  const verificationMode = import.meta.env.VITE_VERIFICATION_MODE || 'SIMULATED';

  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-title">Zenta ERP</div>
          <div className="sidebar-logo-subtitle">Zenta - ZK Payroll</div>
        </div>

        <nav className="sidebar-section">
          <div className="sidebar-section-label">V1 Modules</div>
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.exact}
              className={({ isActive }) => `sidebar-nav-item${isActive ? ' active' : ''}`}
            >
              <span className="nav-glyph">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-version-tag">v1.0.0 - MVP</div>
          <div style={{ fontSize: '10px', color: 'var(--color-on-surface-dim)', marginTop: '4px' }}>
            SIMULATED first, Circom later
          </div>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <span className="topbar-page-title">{pageTitle}</span>
          <span className="topbar-spacer" />
          <span className={`topbar-badge ${verificationMode === 'STELLAR_TESTNET' ? 'stellar' : 'simulated'}`}>
            ZK {verificationMode === 'STELLAR_TESTNET' ? 'Stellar Testnet' : 'Simulated Mode'}
          </span>
        </header>

        <main className="app-content">
          {children}
        </main>
      </div>
    </div>
  );
}
