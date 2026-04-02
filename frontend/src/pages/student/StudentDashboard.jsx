/**
 * Student Dashboard — Main layout with sidebar navigation.
 */
import { NavLink, Outlet } from 'react-router-dom';
import Navbar from '../../components/Navbar';

const NAV_ITEMS = [
  { path: '/student', icon: '📊', label: 'Dashboard', end: true },
  { path: '/student/timetable', icon: '📅', label: 'View Timetable' },
  { path: '/student/select-classes', icon: '✅', label: 'Select Classes' },
  { path: '/student/my-classes', icon: '📚', label: 'My Classes' },
];

export default function StudentDashboard() {
  return (
    <div className="min-h-screen">
      <aside className="sidebar">
        <div className="px-6 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md flex items-center justify-center bg-brand-yellow shadow-sm">
              <span className="text-lg">🎓</span>
            </div>
            <div>
              <div className="text-sm font-bold text-brand-dark" style={{ fontFamily: 'var(--font-heading)' }}>TTMS</div>
              <div className="text-xs text-surface-600">Student Portal</div>
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
 * Student Home
 */
export function StudentHome() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-brand-dark mb-6" style={{ fontFamily: 'var(--font-heading)' }}>
        Student Dashboard
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'View Timetable', path: '/student/timetable', icon: '📅', desc: 'See the published timetable for your degree', color: 'bg-brand-blue', border: 'border-t-4 border-brand-blue' },
          { label: 'Select Classes', path: '/student/select-classes', icon: '✅', desc: 'Enroll in available classes and time slots', color: 'bg-brand-yellow', border: 'border-t-4 border-brand-yellow' },
          { label: 'My Classes', path: '/student/my-classes', icon: '📚', desc: 'View your enrolled classes and schedule', color: 'bg-brand-blue', border: 'border-t-4 border-brand-blue' },
        ].map(item => (
          <a href={item.path} key={item.label} className={`glass-card p-6 block cursor-pointer hover:shadow-lg transition-all ${item.border}`} style={{ textDecoration: 'none' }}>
            <div className={`w-12 h-12 rounded-md flex items-center justify-center mb-4 ${item.color} ${item.color === 'bg-brand-yellow' ? 'text-brand-dark' : 'text-white'} shadow-sm`}>
              <span className="text-2xl">{item.icon}</span>
            </div>
            <h3 className="text-lg font-bold text-brand-dark mb-2" style={{ fontFamily: 'var(--font-heading)' }}>{item.label}</h3>
            <p className="text-sm text-surface-600">{item.desc}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
