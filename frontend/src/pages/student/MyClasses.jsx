/**
 * My Classes — Student's enrolled classes.
 */
import { useState, useEffect } from 'react';
import api from '../../api/axios';
import Toast from '../../components/Toast';
import { calculateDuration } from '../../utils/timeUtils';

const DAY_ORDER = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5 };

export default function MyClasses() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const fetchClasses = async () => {
    try {
      const { data } = await api.get('/student/my-classes');
      setClasses(data);
    } catch {
      setToast({ message: 'Failed to load classes', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClasses(); }, []);

  const handleUnenroll = async (selectionId) => {
    if (!window.confirm('Are you sure you want to drop this class?')) return;
    try {
      await api.delete(`/student/unenroll/${selectionId}`);
      setToast({ message: 'Unenrolled successfully', type: 'success' });
      fetchClasses();
    } catch {
      setToast({ message: 'Unenroll failed', type: 'error' });
    }
  };

  // Group by day
  const grouped = classes.reduce((acc, cls) => {
    const day = cls.day_of_week;
    if (!acc[day]) acc[day] = [];
    acc[day].push(cls);
    return acc;
  }, {});
  const sortedDays = Object.keys(grouped).sort((a, b) => (DAY_ORDER[a] || 9) - (DAY_ORDER[b] || 9));

  return (
    <div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <h2 className="text-2xl font-bold text-surface-100 mb-6" style={{ fontFamily: 'var(--font-heading)' }}>
        📚 My Classes
      </h2>

      {loading ? (
        <div className="glass-card p-12 text-center text-surface-400">Loading...</div>
      ) : classes.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-surface-400 mb-3">You haven't enrolled in any classes yet</p>
          <a href="/student/select-classes" className="btn btn-primary btn-sm">Browse Classes</a>
        </div>
      ) : (
        <>
          <div className="glass-card p-4 mb-6">
            <div className="flex items-center gap-4">
              <span className="text-sm text-surface-400">Total enrolled:</span>
              <span className="badge badge-primary">{classes.length} classes</span>
            </div>
          </div>

          <div className="space-y-6">
            {sortedDays.map(day => (
              <div key={day}>
                <h3 className="text-lg font-bold text-surface-200 mb-3" style={{ fontFamily: 'var(--font-heading)' }}>{day}</h3>
                <div className="space-y-2">
                  {grouped[day].sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '')).map(cls => (
                    <div key={cls.selection_id} className="glass-card p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary-600/20">
                          <span className="text-primary-400 font-bold text-xs">{cls.start_time?.substring(0, 5)}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="badge badge-primary text-xs">{cls.unit_code}</span>
                            <span className="text-sm font-medium text-surface-100">{cls.unit_name}</span>
                          </div>
                          <div className="text-xs text-surface-400 flex gap-3">
                            <span>🕐 {cls.start_time?.substring(0, 5)} – {cls.end_time?.substring(0, 5)} ({calculateDuration(cls.start_time, cls.end_time)})</span>
                            <span>📍 {cls.room_number}</span>
                            <span>👤 {cls.tutor_name}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleUnenroll(cls.selection_id)}
                        className="btn btn-danger btn-sm"
                      >
                        Drop
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
