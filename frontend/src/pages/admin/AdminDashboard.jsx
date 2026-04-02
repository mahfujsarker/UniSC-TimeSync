/**
 * Admin Dashboard — Main layout with sidebar navigation.
 */
import { NavLink, Outlet } from 'react-router-dom';
import Navbar from '../../components/Navbar';

const NAV_ITEMS = [
  { path: '/admin', icon: '📊', label: 'Dashboard', end: true },
  { path: '/admin/degrees', icon: '🎓', label: 'Degrees' },
  { path: '/admin/units', icon: '📚', label: 'Units' },
  { path: '/admin/trimesters', icon: '📆', label: 'Trimesters' },
  { path: '/admin/classrooms', icon: '🏫', label: 'Classrooms' },
  { path: '/admin/tutors', icon: '👨‍🏫', label: 'Tutors' },
  { path: '/admin/timetable', icon: '📅', label: 'Timetable' },
  { path: '/admin/calendar', icon: '🗓️', label: 'Calendar' },
];

export default function AdminDashboard() {
  return (
    <div className="min-h-screen">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="px-6 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md flex items-center justify-center bg-brand-blue shadow-sm">
              <span className="text-lg">📅</span>
            </div>
            <div>
              <div className="text-sm font-bold text-brand-dark" style={{ fontFamily: 'var(--font-heading)' }}>TTMS</div>
              <div className="text-xs text-surface-600">Admin Panel</div>
            </div>
          </div>
        </div>

        <nav className="flex-1">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="px-6 py-4 border-t border-surface-800">
          <div className="text-xs text-surface-600 text-center">© 2026 TTMS</div>
        </div>
      </aside>

      {/* Main content */}
      <Navbar />
      <main className="pt-16" style={{ marginLeft: '260px', minHeight: '100vh' }}>
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

/**
 * Admin Home — Shows summary statistics.
 */
export function AdminHome() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-brand-dark mb-6" style={{ fontFamily: 'var(--font-heading)' }}>
        Admin Dashboard
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Degrees', icon: '🎓', color: 'bg-brand-blue' },
          { label: 'Classrooms', icon: '🏫', color: 'bg-brand-yellow' },
          { label: 'Tutors', icon: '👨‍🏫', color: 'bg-brand-blue' },
          { label: 'Timetable Entries', icon: '📅', color: 'bg-brand-yellow' },
        ].map(stat => (
          <div key={stat.label} className="glass-card p-5 border-t-4 border-brand-blue">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-md flex items-center justify-center ${stat.color} ${stat.color === 'bg-brand-yellow' ? 'text-brand-dark' : 'text-white'}`}>
                <span className="text-lg">{stat.icon}</span>
              </div>
              <div className="text-sm font-semibold text-surface-700">{stat.label}</div>
            </div>
            <div className="text-2xl font-bold text-brand-dark" style={{ fontFamily: 'var(--font-heading)' }}>—</div>
            <div className="text-xs text-brand-blue mt-1 font-medium">Manage in sidebar →</div>
          </div>
        ))}
      </div>

      <div className="glass-card p-6 border-t-4 border-brand-yellow">
        <h3 className="text-lg font-bold text-brand-dark mb-4" style={{ fontFamily: 'var(--font-heading)' }}>Quick Start Guide</h3>
        <div className="space-y-3">
          {[
            { step: '1', text: 'Create globally available Trimesters', icon: '📆' },
            { step: '2', text: 'Create Degrees (e.g., Master of ICT)', icon: '🎓' },
            { step: '3', text: 'Create Units with student count & duration', icon: '📚' },
            { step: '4', text: 'Set up Classrooms with capacity and type', icon: '🏫' },
            { step: '5', text: 'Register Tutors and assign them to units', icon: '👨‍🏫' },
            { step: '6', text: 'Classes auto-generate based on capacity', icon: '✨' },
            { step: '7', text: 'Drag classes to schedule in timetable grid', icon: '📅' },
          ].map(item => (
            <div key={item.step} className="flex items-center gap-4 p-3 rounded-md hover:bg-surface-50 transition-colors border border-transparent hover:border-surface-200">
              <div className="w-8 h-8 rounded-md flex items-center justify-center bg-brand-blue text-white text-sm font-bold shadow-sm">{item.step}</div>
              <span className="text-sm font-medium text-surface-700">{item.icon} {item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
