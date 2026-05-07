import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../api/axios';
import RoutineTable from '../../components/RoutineTable';
import {
  downloadRoutineExcel,
  downloadRoutinePdf,
  formatDate,
  formatGeneratedDate,
  normalizeTimetableEntries
} from '../../utils/timetableRoutine';

export default function RoutineTimetable() {
  const { trimesterId } = useParams();
  const [trimester, setTrimester] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    Promise.all([
      api.get(`/trimesters/${trimesterId}`),
      api.get(`/timetable?trimester_id=${trimesterId}`)
    ])
      .then(([trimesterRes, timetableRes]) => {
        if (!active) return;
        setTrimester(trimesterRes.data);
        setEntries(normalizeTimetableEntries(timetableRes.data));
        setError('');
      })
      .catch(() => {
        if (active) setError('Failed to load timetable routine');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [trimesterId]);

  const handleDownloadPdf = () => {
    downloadRoutinePdf(trimester, entries);
  };

  const handleDownloadExcel = () => {
    downloadRoutineExcel(trimester, entries);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-surface-900" style={{ fontFamily: 'var(--font-heading)' }}>
            Timetable Routine
          </h2>
          <p className="text-sm text-surface-600 mt-1">
            {trimester
              ? `${trimester.name} | ${formatDate(trimester.start_date)} - ${formatDate(trimester.end_date)}`
              : 'Selected trimester/session'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/timetable" className="btn btn-sm btn-secondary">Back to Timetable</Link>
          <button className="btn btn-sm btn-secondary" onClick={handleDownloadPdf} disabled={loading || !trimester}>
            Download as PDF
          </button>
          <button className="btn btn-sm btn-primary" onClick={handleDownloadExcel} disabled={loading || !trimester}>
            Download as Excel
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-surface-200 p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-surface-700">
          <div><span className="font-semibold">Trimester/session:</span> {trimester?.name || '-'}</div>
          <div><span className="font-semibold">Generated:</span> {formatGeneratedDate()}</div>
          <div><span className="font-semibold">Classes:</span> {entries.length}</div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg border border-surface-200 p-12 text-center text-surface-500">Loading routine...</div>
      ) : error ? (
        <div className="bg-white rounded-lg border border-danger/30 p-12 text-center text-danger">{error}</div>
      ) : entries.length === 0 ? (
        <div className="bg-white rounded-lg border border-surface-200 p-12 text-center text-surface-500">
          No timetable entries for this trimester/session
        </div>
      ) : (
        <RoutineTable entries={entries} />
      )}
    </div>
  );
}
