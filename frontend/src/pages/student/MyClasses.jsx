/**
 * My Classes - Student's enrolled classes.
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

      <div className="page-header">
        <div>
          <p className="page-kicker">Enrolled schedule</p>
          <h2 className="page-title" style={{ fontFamily: 'var(--font-heading)' }}>My Classes</h2>
          <p className="page-subtitle">Review your enrolled classes grouped by teaching day.</p>
        </div>
      </div>

      {loading ? (
        <div className="glass-card p-12 text-center text-surface-500">Loading...</div>
      ) : classes.length === 0 ? (
        <div className="empty-state">
          <p className="mb-3">You haven't enrolled in any classes yet.</p>
          <a href="/student/select-classes" className="btn btn-primary btn-sm">Browse Classes</a>
        </div>
      ) : (
        <>
          <div className="glass-card p-4 mb-6">
            <div className="flex items-center gap-4">
              <span className="text-sm text-surface-600">Total enrolled:</span>
              <span className="badge badge-primary">{classes.length} classes</span>
            </div>
          </div>

          <div className="space-y-6">
            {sortedDays.map(day => (
              <div key={day}>
                <h3 className="text-lg font-bold text-brand-dark mb-3" style={{ fontFamily: 'var(--font-heading)' }}>{day}</h3>
                <div className="space-y-2">
                  {grouped[day].sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '')).map(cls => (
                    <div key={cls.selection_id} className="glass-card p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-brand-blue/10">
                          <span className="text-brand-blue font-bold text-xs">{cls.start_time?.substring(0, 5)}</span>
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="badge badge-primary text-xs">{cls.unit_code}</span>
                            <span className="text-sm font-semibold text-brand-dark">{cls.unit_name}</span>
                          </div>
                          <div className="text-xs text-surface-600 flex flex-wrap gap-3">
                            <span>{cls.start_time?.substring(0, 5)} - {cls.end_time?.substring(0, 5)} ({calculateDuration(cls.start_time, cls.end_time)})</span>
                            <span>Room {cls.room_number}</span>
                            <span>{cls.tutor_name}</span>
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
