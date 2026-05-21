/**
 * Select Classes — Student enrollment page.
 */
import { useState, useEffect } from 'react';
import api from '../../api/axios';
import Toast from '../../components/Toast';
import { calculateDuration } from '../../utils/timeUtils';

export default function SelectClasses() {
  const [degrees, setDegrees] = useState([]);
  const [trimesters, setTrimesters] = useState([]);
  const [selectedDegree, setSelectedDegree] = useState('');
  const [selectedTrimester, setSelectedTrimester] = useState('');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [enrolling, setEnrolling] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/degrees'),
      api.get('/trimesters?status=published')
    ]).then(([dRes, tRes]) => {
      setDegrees(dRes.data);
      setTrimesters(tRes.data);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedTrimester && selectedDegree) {
      setLoading(true);
      api.get(`/student/timetable?trimester_id=${selectedTrimester}&degree_id=${selectedDegree}`)
        .then(res => setEntries(res.data))
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setEntries([]);
    }
  }, [selectedTrimester, selectedDegree]);

  const handleEnroll = async (entryId) => {
    setEnrolling(entryId);
    try {
      await api.post('/student/enroll', { timetable_entry_id: entryId });
      setToast({ message: 'Enrolled successfully!', type: 'success' });
      // Refresh data
      const { data } = await api.get(`/student/timetable?trimester_id=${selectedTrimester}&degree_id=${selectedDegree}`);
      setEntries(data);
    } catch (err) {
      setToast({ message: err.response?.data?.error || 'Enrollment failed', type: 'error' });
    } finally {
      setEnrolling(null);
    }
  };

  return (
    <div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div className="page-header">
        <div>
          <p className="page-kicker">Enrollment</p>
          <h2 className="page-title" style={{ fontFamily: 'var(--font-heading)' }}>Select Classes</h2>
          <p className="page-subtitle">Browse scheduled classes and enroll while capacity is available.</p>
        </div>
      </div>

      <div className="glass-card p-4 mb-6 border-t-4 border-brand-yellow">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="form-group">
            <label className="form-label">Degree</label>
            <select className="form-select" value={selectedDegree} onChange={e => setSelectedDegree(e.target.value)}>
              <option value="">Select degree...</option>
              {degrees.map(d => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Trimester</label>
            <select className="form-select" value={selectedTrimester} onChange={e => setSelectedTrimester(e.target.value)} disabled={!selectedDegree}>
              <option value="">Select teaching period...</option>
              {trimesters.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {!selectedTrimester ? (
        <div className="empty-state">Select a degree and trimester to browse classes.</div>
      ) : loading ? (
        <div className="glass-card p-12 text-center text-surface-500">Loading classes...</div>
      ) : entries.length === 0 ? (
        <div className="empty-state">No classes available for this trimester.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {entries.map(entry => {
            const isFull = entry.enrolled_count >= entry.max_capacity;
            return (
              <div key={entry.id} className="glass-card p-5 hover:border-brand-blue hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="badge badge-primary mr-2">{entry.unit_code}</span>
                    <span className={`badge ${entry.room_type === 'lab' ? 'badge-warning' : 'badge-success'}`}>{entry.room_type}</span>
                  </div>
                  <span className="badge badge-primary bg-[#e6eeff] text-[#0044a3]">{entry.day_of_week}</span>
                </div>
                <h3 className="text-sm font-bold text-brand-dark mb-2">{entry.unit_name}</h3>
                <div className="space-y-1 text-xs text-surface-600 mb-3 font-medium">
                  <div>🕐 {entry.start_time?.substring(0, 5)} – {entry.end_time?.substring(0, 5)} ({calculateDuration(entry.start_time, entry.end_time)})</div>
                  <div>📍 {entry.room_number} ({entry.room_location})</div>
                  <div>👤 {entry.tutor_name}</div>
                </div>

                {/* Capacity bar */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-1.5 flex-1 bg-surface-200 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min((entry.enrolled_count / entry.max_capacity) * 100, 100)}%`,
                        background: isFull ? 'var(--color-danger)' : 'var(--color-brand-blue)',
                      }}
                    />
                  </div>
                  <span className="text-xs text-brand-dark font-medium">{entry.enrolled_count}/{entry.max_capacity}</span>
                </div>

                <button
                  onClick={() => handleEnroll(entry.id)}
                  className={`btn w-full ${isFull ? 'btn-secondary' : 'btn-primary'} btn-sm`}
                  disabled={isFull || enrolling === entry.id}
                >
                  {enrolling === entry.id ? 'Enrolling...' : isFull ? 'Full' : 'Enroll'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
