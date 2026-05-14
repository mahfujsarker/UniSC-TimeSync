/**
 * Navbar Component
 * Displays logo, user info, and logout button.
 */
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Navbar({ onToggleMobileSidebar }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="app-navbar">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="nav-menu-btn lg:hidden"
          onClick={onToggleMobileSidebar}
          aria-label="Open navigation"
        >
          <span />
          <span />
          <span />
        </button>
        <h1 className="text-lg font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
          <span className="text-brand-dark">UniSC TimeSync</span>
          <span className="text-surface-600 font-normal ml-2 text-sm hidden md:inline">Timetable Management System</span>
        </h1>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right hidden sm:block">
          <div className="text-sm font-semibold text-brand-dark">{user?.full_name}</div>
          <div className="text-xs text-surface-500 capitalize">{user?.role}</div>
        </div>
        <button onClick={handleLogout} className="btn btn-secondary btn-sm">
          Logout
        </button>
      </div>
    </header>
  );
}
