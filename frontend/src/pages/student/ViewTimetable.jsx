/**
 * View Timetable — Student read-only Kanban view.
 */
import { useState, useEffect } from 'react';
/* eslint-disable react-hooks/set-state-in-effect */
import api from '../../api/axios';
import KanbanBoard from '../../components/KanbanBoard';

export default function ViewTimetable() {
  const [degrees, setDegrees] = useState([]);
  const [trimesters, setTrimesters] = useState([]);
  const [selectedDegree, setSelectedDegree] = useState('');
  const [selectedTrimester, setSelectedTrimester] = useState('');
  const [kanbanData, setKanbanData] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/degrees'),
      api.get('/trimesters')
    ]).then(([dRes, tRes]) => {
      setDegrees(dRes.data);
      setTrimesters(tRes.data);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedTrimester || !selectedDegree) {
      setKanbanData({});
      return;
    }

    const abortController = new AbortController();
    setLoading(true);

    api.get(`/timetable/kanban/${selectedTrimester}?degree_id=${selectedDegree}`, { signal: abortController.signal })
      .then(res => setKanbanData(res.data))
      .catch(() => {})
      .finally(() => {
        if (!abortController.signal.aborted) setLoading(false);
      });

    return () => abortController.abort();
  }, [selectedTrimester, selectedDegree]);

  return (
    <div>
      <h2 className="text-2xl font-bold text-surface-100 mb-6" style={{ fontFamily: 'var(--font-heading)' }}>
        📅 View Timetable
      </h2>

      <div className="glass-card p-4 mb-6">
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
              <option value="">Select trimester...</option>
              {trimesters.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {!selectedTrimester ? (
        <div className="glass-card p-12 text-center">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-surface-400">Select a degree and trimester to view the timetable</p>
        </div>
      ) : loading ? (
        <div className="glass-card p-12 text-center text-surface-400">Loading...</div>
      ) : (
        <KanbanBoard data={kanbanData} readOnly={true} />
      )}
    </div>
  );
}
/* eslint-enable react-hooks/set-state-in-effect */
