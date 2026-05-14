/**
 * View Timetable - Student read-only Kanban view.
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
      <div className="page-header">
        <div>
          <p className="page-kicker">Published schedule</p>
          <h2 className="page-title" style={{ fontFamily: 'var(--font-heading)' }}>View Timetable</h2>
          <p className="page-subtitle">Choose your degree and trimester to view the read-only timetable board.</p>
        </div>
      </div>

      <div className="glass-card p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="form-group">
            <label className="form-label">Degree</label>
            <select className="form-select" value={selectedDegree} onChange={e => setSelectedDegree(e.target.value)}>
              <option value="">Select degree...</option>
              {degrees.map(d => <option key={d.id} value={d.id}>{d.code} - {d.name}</option>)}
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
        <div className="empty-state">
          Select a degree and trimester to view the timetable.
        </div>
      ) : loading ? (
        <div className="glass-card p-12 text-center text-surface-500">Loading timetable...</div>
      ) : (
        <KanbanBoard data={kanbanData} readOnly={true} />
      )}
    </div>
  );
}
/* eslint-enable react-hooks/set-state-in-effect */
