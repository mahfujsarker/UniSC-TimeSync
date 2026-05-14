/**
 * View-Only Timetable - read-only routine viewer and exporter.
 */
import { useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
import RoutineTable from '../../components/RoutineTable';
import {
  downloadRoutineExcel,
  downloadRoutinePdf,
  formatDate,
  normalizeTimetableEntries
} from '../../utils/timetableRoutine';

export default function ViewOnlyTimetable({ publicMode = false }) {
  const [degrees, setDegrees] = useState([]);
  const [trimesters, setTrimesters] = useState([]);
  const [selectedDegree, setSelectedDegree] = useState('');
  const [selectedTrimester, setSelectedTrimester] = useState('');
  const [entries, setEntries] = useState([]);
  const [loadingLookups, setLoadingLookups] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    Promise.all([
      api.get('/public/degrees'),
      api.get('/public/trimesters')
    ])
      .then(([degreeRes, trimesterRes]) => {
        if (!active) return;
        setDegrees(degreeRes.data);
        setTrimesters(trimesterRes.data);
      })
      .catch(() => {
        if (active) setError('Failed to load filters.');
      })
      .finally(() => {
        if (active) setLoadingLookups(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedDegree || !selectedTrimester) {
      return;
    }

    let active = true;

    const params = new URLSearchParams({
      degree_id: selectedDegree,
      trimester_id: selectedTrimester
    });

    api.get(`/public/timetable?${params.toString()}`)
      .then(res => {
        if (!active) return;
        setEntries(normalizeTimetableEntries(res.data));
      })
      .catch(() => {
        if (active) setError('Failed to load timetable entries.');
      })
      .finally(() => {
        if (active) setLoadingEntries(false);
      });

    return () => {
      active = false;
    };
  }, [selectedDegree, selectedTrimester]);

  const selectedDegreeData = useMemo(
    () => degrees.find(degree => String(degree.id) === String(selectedDegree)),
    [degrees, selectedDegree]
  );
  const selectedTrimesterData = useMemo(
    () => trimesters.find(trimester => String(trimester.id) === String(selectedTrimester)),
    [trimesters, selectedTrimester]
  );

  const canExport = Boolean(selectedDegreeData && selectedTrimesterData);
  const exportOptions = { degree: selectedDegreeData, projectName: 'UniSC TimeSync' };

  const handleDegreeChange = (value) => {
    setSelectedDegree(value);
    setEntries([]);
    setError('');
    setLoadingEntries(Boolean(value && selectedTrimester));
  };

  const handleTrimesterChange = (value) => {
    setSelectedTrimester(value);
    setEntries([]);
    setError('');
    setLoadingEntries(Boolean(selectedDegree && value));
  };

  const content = (
    <div>
      <div className="page-header">
        <div>
          <p className="page-kicker">Read-only routine</p>
          <h2 className="page-title">View-Only Timetable</h2>
          <p className="page-subtitle">
            View and download routines without generating, editing, deleting, or moving timetable entries.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => downloadRoutinePdf(selectedTrimesterData, entries, exportOptions)}
            disabled={!canExport}
          >
            Download PDF
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => downloadRoutineExcel(selectedTrimesterData, entries, exportOptions)}
            disabled={!canExport}
          >
            Download Excel
          </button>
        </div>
      </div>

      {error && <div className="alert-card alert-error mb-5">{error}</div>}

      <div className="glass-card p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="form-group">
            <label className="form-label">Degree</label>
            <select
              className="form-select"
              value={selectedDegree}
              onChange={e => handleDegreeChange(e.target.value)}
              disabled={loadingLookups}
            >
              <option value="">Select degree...</option>
              {degrees.map(degree => (
                <option key={degree.id} value={degree.id}>{degree.code} - {degree.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Trimester / Session</label>
            <select
              className="form-select"
              value={selectedTrimester}
              onChange={e => handleTrimesterChange(e.target.value)}
              disabled={loadingLookups}
            >
              <option value="">Select trimester...</option>
              {trimesters.map(trimester => (
                <option key={trimester.id} value={trimester.id}>{trimester.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="glass-card p-4 mb-4">
        <div className="grid grid-cols-1 gap-3 text-sm text-surface-700 md:grid-cols-4">
          <div><span className="font-semibold">Project:</span> UniSC TimeSync</div>
          <div><span className="font-semibold">Degree:</span> {selectedDegreeData ? `${selectedDegreeData.name} (${selectedDegreeData.code})` : '-'}</div>
          <div><span className="font-semibold">Trimester:</span> {selectedTrimesterData?.name || '-'}</div>
          <div>
            <span className="font-semibold">Date:</span>{' '}
            {selectedTrimesterData
              ? `${formatDate(selectedTrimesterData.start_date)} - ${formatDate(selectedTrimesterData.end_date)}`
              : '-'}
          </div>
        </div>
      </div>

      {!selectedDegree || !selectedTrimester ? (
        <div className="empty-state">Select a degree and trimester/session to view the routine.</div>
      ) : loadingEntries ? (
        <div className="glass-card p-12 text-center text-surface-500">Loading timetable...</div>
      ) : entries.length === 0 ? (
        <div className="empty-state">No timetable entries found for this degree and trimester/session.</div>
      ) : (
        <RoutineTable entries={entries} />
      )}
    </div>
  );

  if (!publicMode) return content;

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-[1600px]">
        <header className="glass-panel mb-6 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="brand-mark">TS</div>
            <div>
              <div className="text-lg font-black text-brand-dark">UniSC TimeSync</div>
              <div className="text-sm text-surface-600">Timetable Management System</div>
            </div>
          </div>
          <div className="text-sm font-semibold text-surface-600">Public view-only timetable</div>
        </header>
        {content}
      </div>
    </div>
  );
}
