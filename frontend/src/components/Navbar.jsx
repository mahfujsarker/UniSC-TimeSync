/**
 * Navbar Component
 * Displays logo, user info, and logout button.
 */
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="h-16 bg-surface-900/80 backdrop-blur-xl border-b border-surface-200/10 flex items-center justify-between px-6 fixed top-0 left-0 right-0 z-30" style={{ marginLeft: '260px' }}>
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
          <span className="text-primary-400">TTMS</span>
          <span className="text-surface-400 font-normal ml-2 text-sm">Time Table Management</span>
        </h1>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-sm font-medium text-surface-200">{user?.full_name}</div>
          <div className="text-xs text-surface-500 capitalize">{user?.role}</div>
        </div>
        <button onClick={handleLogout} className="btn btn-secondary btn-sm">
          Logout
        </button>
      </div>
    </header>
  );
}
