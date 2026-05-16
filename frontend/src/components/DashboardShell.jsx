import { NavLink, Outlet } from 'react-router-dom';
import { useState } from 'react';
import Navbar from './Navbar';

const ICONS = {
  dashboard: (
    <path d="M4 13h6V4H4v9Zm10 7h6V4h-6v16ZM4 20h6v-5H4v5Z" />
  ),
  degrees: (
    <path d="m3 8 9-4 9 4-9 4-9-4Zm4 3v4c0 1.4 2.2 3 5 3s5-1.6 5-3v-4" />
  ),
  courses: (
    <path d="M6 4h9a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3V6a2 2 0 0 1 2-2Zm1 0v13a3 3 0 0 0 3 3" />
  ),
  trimesters: (
    <path d="M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1Z" />
  ),
  tutors: (
    <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-7 8a7 7 0 0 1 14 0" />
  ),
  classrooms: (
    <path d="M4 20V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14M8 8h2m4 0h2M8 12h2m4 0h2M3 20h18" />
  ),
  timetable: (
    <path d="M4 5h16v15H4V5Zm0 5h16M9 5v15m5-15v15" />
  ),
  download: (
    <path d="M12 4v10m0 0 4-4m-4 4-4-4M5 20h14" />
  ),
  view: (
    <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Zm9.5 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
  ),
  calendar: (
    <path d="M7 3v3m10-3v3M5 5h14v16H5V5Zm3 8h3m3 0h3m-9 4h3" />
  ),
  profile: (
    <path d="M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" />
  ),
};

function IconBadge({ value }) {
  return (
    <span className="nav-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        {ICONS[value] || ICONS.dashboard}
      </svg>
    </span>
  );
}

export default function DashboardShell({ navItems, portalLabel, accent = 'blue' }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarWidth = collapsed ? 88 : 280;

  return (
    <div className="app-shell" style={{ '--sidebar-width': `${sidebarWidth}px` }}>
      {mobileOpen && (
        <button
          type="button"
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`app-sidebar ${collapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'is-mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <div className={`brand-mark ${accent === 'yellow' ? 'brand-mark-yellow' : ''}`}>
            TS
          </div>
          <div className="brand-copy">
            <div className="brand-title">UniSC TimeSync</div>
            <div className="brand-subtitle">Timetable Management System</div>
            <div className="brand-subtitle">{portalLabel}</div>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label={`${portalLabel} navigation`}>
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              title={collapsed ? item.label : undefined}
              data-label={item.label}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={() => setMobileOpen(false)}
            >
              <IconBadge value={item.icon} />
              <span className="sidebar-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button
            type="button"
            className="sidebar-collapse"
            onClick={() => {
              setMobileOpen(false);
              setCollapsed(value => !value);
            }}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <span aria-hidden="true">{collapsed ? '>' : '<'}</span>
            <span className="sidebar-label">{collapsed ? 'Expand' : 'Collapse'}</span>
          </button>
        </div>
      </aside>

      <Navbar
        onToggleMobileSidebar={() => setMobileOpen(value => !value)}
      />

      <main className="app-main">
        <div className="page-transition">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
