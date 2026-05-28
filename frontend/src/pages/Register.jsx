/**
 * Register Page
 */
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const [form, setForm] = useState({ email: '', password: '', full_name: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      return setError('Passwords do not match');
    }
    if (form.password.length < 6) {
      return setError('Password must be at least 6 characters');
    }

    setLoading(true);
    try {
      await register(form.email, form.password, form.full_name);
      navigate('/student');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/70 bg-white/55 shadow-2xl backdrop-blur-2xl lg:grid-cols-[1fr_28rem]">
        <div className="hidden p-10 lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="brand-mark brand-mark-yellow mb-8">TS</div>
            <p className="page-kicker">Student access</p>
            <h1 className="mt-3 text-4xl font-black leading-tight text-brand-dark">
              UniSC TimeSync: Timetable Management System
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-surface-600">
              Register as a student to browse available class times, enroll, and view your personal timetable.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs text-surface-600">
            <div className="glass-panel p-3">Browse timetable</div>
            <div className="glass-panel p-3">Select classes</div>
            <div className="glass-panel p-3">Track schedule</div>
          </div>
        </div>

        <div className="glass-panel rounded-none p-8 sm:p-10">
          <div className="mb-8">
            <div className="brand-mark brand-mark-yellow mb-5 lg:hidden">TS</div>
            <p className="page-kicker">Create account</p>
            <h2 className="mt-2 text-3xl font-black text-brand-dark" style={{ fontFamily: 'var(--font-heading)' }}>Register</h2>
            <p className="text-surface-600 text-sm mt-1">Join UniSC TimeSync as a student.</p>
          </div>

          {error && (
            <div className="mb-4 alert-card alert-error">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-group">
              <label className="form-label" htmlFor="reg-name">Full Name</label>
              <input id="reg-name" name="full_name" className="form-input" placeholder="John Smith" value={form.full_name} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="reg-email">Email</label>
              <input id="reg-email" name="email" type="email" className="form-input" placeholder="student.timesync@usc.edu.au" value={form.email} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="reg-pass">Password</label>
              <input id="reg-pass" name="password" type="password" className="form-input" placeholder="Min. 6 characters" value={form.password} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="reg-confirm">Confirm Password</label>
              <input id="reg-confirm" name="confirmPassword" type="password" className="form-input" placeholder="Re-enter password" value={form.confirmPassword} onChange={handleChange} required />
            </div>
            <button type="submit" className="btn btn-primary w-full" disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-surface-600 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-blue hover:text-brand-dark font-semibold">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
