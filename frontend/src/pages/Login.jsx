/**
 * Login Page
 */
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(email, password);
      navigate(data.user.role === 'admin' ? '/admin' : '/student');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/70 bg-white/55 shadow-2xl backdrop-blur-2xl lg:grid-cols-[1fr_28rem]">
        <div className="hidden p-10 lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="brand-mark mb-8">TS</div>
            <p className="page-kicker">UniSC TimeSync</p>
            <h1 className="mt-3 text-4xl font-black leading-tight text-brand-dark">
              UniSC TimeSync: Timetable Management System
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-surface-600">
              A professional scheduling portal for administrators and students with protected access and live timetable workflows.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs text-surface-600">
            <div className="glass-panel p-3">Conflict validation</div>
            <div className="glass-panel p-3">Room capacity checks</div>
            <div className="glass-panel p-3">Student enrollment</div>
          </div>
        </div>

        <div className="glass-panel rounded-none p-8 sm:p-10">
          <div className="mb-8">
            <div className="brand-mark mb-5 lg:hidden">TS</div>
            <p className="page-kicker">Welcome back</p>
            <h2 className="mt-2 text-3xl font-black text-brand-dark" style={{ fontFamily: 'var(--font-heading)' }}>Sign in</h2>
            <p className="text-surface-600 text-sm mt-1">Access UniSC TimeSync.</p>
          </div>

          {error && (
            <div className="mb-4 alert-card alert-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-group">
              <label className="form-label" htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                className="form-input"
                placeholder="you@university.edu"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                className="form-input"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <Link to="/view-only-timetable" className="btn btn-secondary w-full mt-3">
            View public timetable
          </Link>

          <p className="text-center text-sm text-surface-600 mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-brand-blue hover:text-brand-dark font-semibold">
              Register here
            </Link>
          </p>

          <div className="mt-6 rounded-xl border border-white/70 bg-white/55 p-3">
            <p className="text-xs text-surface-600 text-center">
              <strong>Demo:</strong> admin@ttms.edu / admin123 | student@ttms.edu / student123
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
