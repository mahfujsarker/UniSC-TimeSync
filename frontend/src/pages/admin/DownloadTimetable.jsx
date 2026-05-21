import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import {
  downloadRoutineExcel,
  downloadRoutinePdf,
  formatDate,
  normalizeTimetableEntries
} from '../../utils/timetableRoutine';

export default function DownloadTimetable() {
  const [trimesters, setTrimesters] = useState([]);
  const [entryCounts, setEntryCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    api.get('/trimesters?status=published')
      .then(async res => {
        if (!active) return;
        setTrimesters(res.data);

        const countPairs = await Promise.all(
          res.data.map(async trimester => {
            try {
              const timetableRes = await api.get(`/timetable?trimester_id=${trimester.id}`);
              return [trimester.id, normalizeTimetableEntries(timetableRes.data).length];
            } catch {
              return [trimester.id, 0];
            }
          })
        );

        if (active) setEntryCounts(Object.fromEntries(countPairs));
      })
      .catch(() => {
        if (active) setError('Failed to load trimesters');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const getRoutineEntries = async (trimesterId) => {
    const res = await api.get(`/timetable?trimester_id=${trimesterId}`);
    return normalizeTimetableEntries(res.data);
  };

  const handleDownload = async (trimester, type) => {
    const key = `${trimester.id}-${type}`;
    setDownloading(key);
    try {
      const entries = await getRoutineEntries(trimester.id);
      if (type === 'pdf') {
        downloadRoutinePdf(trimester, entries);
      } else {
        downloadRoutineExcel(trimester, entries);
      }
    } finally {
      setDownloading('');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <p className="page-kicker">Exports</p>
          <h2 className="page-title" style={{ fontFamily: 'var(--font-heading)' }}>Download Timetable</h2>
          <p className="page-subtitle">View and download teaching period routines.</p>
        </div>
      </div>

      {loading ? (
        <div className="glass-card p-12 text-center text-surface-500">Loading trimesters...</div>
      ) : error ? (
        <div className="glass-card border-danger/30 p-12 text-center text-danger">{error}</div>
      ) : trimesters.length === 0 ? (
        <div className="empty-state">No trimesters found.</div>
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Teaching Period</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Classes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {trimesters.map(trimester => (
                <tr key={trimester.id}>
                  <td className="font-semibold text-surface-900">{trimester.name}</td>
                  <td>{formatDate(trimester.start_date)}</td>
                  <td>{formatDate(trimester.end_date)}</td>
                  <td>{entryCounts[trimester.id] || 0}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <Link to={`/admin/timetable/routine/${trimester.id}`} className="btn btn-sm btn-secondary">
                        View Routine
                      </Link>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleDownload(trimester, 'pdf')}
                        disabled={downloading === `${trimester.id}-pdf`}
                      >
                        {downloading === `${trimester.id}-pdf` ? 'Preparing...' : 'Download PDF'}
                      </button>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleDownload(trimester, 'excel')}
                        disabled={downloading === `${trimester.id}-excel`}
                      >
                        {downloading === `${trimester.id}-excel` ? 'Preparing...' : 'Download Excel'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
