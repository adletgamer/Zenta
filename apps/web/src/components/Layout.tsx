import { NavLink, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: '⬡', exact: true },
  { path: '/production', label: 'Production Planning', icon: '◈' },
  { path: '/operators', label: 'Operator Assignment', icon: '◉' },
  { path: '/rates', label: 'Rate Management', icon: '◎' },
  { path: '/payroll', label: 'Weekly Payroll', icon: '◆' },
  { path: '/audit', label: 'Audit Log', icon: '◧' },
  { path: '/zk', label: 'ZK Verification', icon: '⬡' },
];

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/production': 'Production Planning',
  '/operators': 'Operator Assignment',
  '/rates': 'Rate Management',
  '/payroll': 'Weekly Payroll',
  '/audit': 'Audit Log',
  '/zk': 'ZK Verification Center',
};

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const pageTitle = PAGE_TITLES[location.pathname] || 'Zenta ERP';
  const verificationMode = import.meta.env.VITE_VERIFICATION_MODE || 'SIMULATED';

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="app-sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-title">Zenta ERP</div>
          <div className="sidebar-logo-subtitle">Zenta · ZK Manufacturing</div>
        </div>

        <nav className="sidebar-section">
          <div className="sidebar-section-label">Modules</div>
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.exact}
              className={({ isActive }) =>
                `sidebar-nav-item${isActive ? ' active' : ''}`
              }
            >
              <span style={{ fontSize: '16px', lineHeight: 1 }}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-version-tag">v1.0.0 · MVP</div>
          <div style={{ fontSize: '10px', color: 'var(--color-on-surface-muted)', marginTop: '4px' }}>
            Stellar Hacks 2025
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="app-main">
        {/* Topbar */}
        <header className="app-topbar">
          <span className="topbar-page-title">{pageTitle}</span>
          <span className="topbar-spacer" />
          <span className={`topbar-badge ${verificationMode === 'STELLAR_TESTNET' ? 'stellar' : 'simulated'}`}>
            ⬡ {verificationMode === 'STELLAR_TESTNET' ? 'Stellar Testnet' : 'Simulated Mode'}
          </span>
        </header>

        {/* Page Content */}
        <main className="app-content">
          {children}
        </main>
      </div>
    </div>
  );
}
