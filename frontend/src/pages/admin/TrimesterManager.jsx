import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
import Toast from '../../components/Toast';

const emptyPeriod = {
  name: '',
  year: new Date().getFullYear(),
  type: 'TRIMESTER',
  code: 'T1',
  period_number: 1,
  start_date: '',
  end_date: '',
  classes_start_date: '',
  classes_end_date: '',
  timetable_release_date: '',
  class_selection_open_date: '',
  census_date: '',
  exam_start_date: '',
  exam_end_date: '',
  grades_release_date: '',
  source_url: '',
  status: 'draft'
};

const fields = [
  ['name', 'Teaching period name'],
  ['type', 'Type'],
  ['code', 'Code'],
  ['period_number', 'No.'],
  ['start_date', 'Start'],
  ['end_date', 'End'],
  ['classes_start_date', 'Classes start'],
  ['classes_end_date', 'Classes end'],
  ['census_date', 'Census'],
  ['exam_start_date', 'Exam start'],
  ['exam_end_date', 'Exam end'],
  ['grades_release_date', 'Grades release'],
  ['source_url', 'Source URL'],
  ['status', 'Status']
];

function periodCode(type, number) {
  if (type === 'SESSION') return `S${number}`;
  if (type === 'SEMESTER') return `SEM${number}`;
  return `T${number}`;
}

export default function TrimesterManager() {
  const [academicYears, setAcademicYears] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [selectedYearId, setSelectedYearId] = useState('');
  const [importYear, setImportYear] = useState(new Date().getFullYear());
  const [sourceUrl, setSourceUrl] = useState('');
  const [manual, setManual] = useState(emptyPeriod);
  const [selectedIds, setSelectedIds] = useState([]);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const selectedYear = useMemo(
    () => academicYears.find(year => String(year.id) === String(selectedYearId)),
    [academicYears, selectedYearId]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [yearRes, periodRes] = await Promise.all([
        api.get('/trimesters/academic-years'),
        api.get('/trimesters')
      ]);
      setAcademicYears(yearRes.data);
      setPeriods(periodRes.data);
      if (!selectedYearId && yearRes.data.length > 0) {
        setSelectedYearId(yearRes.data[0].id);
        setImportYear(yearRes.data[0].year);
      }
    } catch {
      setToast({ message: 'Failed to load academic calendar data', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [selectedYearId]);

  useEffect(() => { loadData(); }, [loadData]);

  const visiblePeriods = periods.filter(period => !selectedYearId || String(period.academic_year_id) === String(selectedYearId));

  const importCalendar = async (event) => {
    event.preventDefault();
    setImporting(true);
    try {
      const res = await api.post('/trimesters/import-unisc', { year: importYear, source_url: sourceUrl });
      setToast({ message: `Imported ${res.data.teaching_periods.length} draft teaching period(s)`, type: 'success' });
      setSelectedYearId(res.data.academic_year.id);
      setSelectedIds(res.data.teaching_periods.map(period => period.id));
      await loadData();
      setPeriods(prev => prev.map(period => {
        const imported = res.data.teaching_periods.find(item => item.id === period.id);
        return imported ? { ...period, ...imported } : period;
      }));
    } catch (err) {
      setToast({
        message: err.response?.data?.error || 'Unable to automatically parse this calendar page. Please review the URL or enter teaching periods manually.',
        type: 'error'
      });
    } finally {
      setImporting(false);
    }
  };

  const savePeriod = async (period) => {
    try {
      const payload = {
        ...period,
        year: period.academic_year || selectedYear?.year || importYear,
        period_number: Number(period.period_number) || null
      };
      await api.put(`/trimesters/${period.id}`, payload);
      setToast({ message: 'Teaching period updated', type: 'success' });
      loadData();
    } catch (err) {
      setToast({ message: err.response?.data?.error || 'Failed to update teaching period', type: 'error' });
    }
  };

  const addManualPeriod = async (event) => {
    event.preventDefault();
    try {
      await api.post('/trimesters', {
        ...manual,
        year: Number(manual.year),
        code: manual.code || periodCode(manual.type, manual.period_number)
      });
      setManual({ ...emptyPeriod, year: manual.year, source_url: sourceUrl });
      setToast({ message: 'Teaching period added in draft status', type: 'success' });
      loadData();
    } catch (err) {
      setToast({ message: err.response?.data?.error || 'Failed to add teaching period', type: 'error' });
    }
  };

  const publishSelected = async () => {
    try {
      const selectedPeriods = periods.filter(period => selectedIds.includes(period.id));
      await Promise.all(selectedPeriods.map(period => api.put(`/trimesters/${period.id}`, {
        ...period,
        year: period.academic_year || selectedYear?.year || importYear,
        period_number: Number(period.period_number) || null
      })));
      await api.post('/trimesters/publish', { ids: selectedIds, academic_year_id: selectedYearId });
      setToast({ message: 'Selected teaching periods published', type: 'success' });
      setSelectedIds([]);
      loadData();
    } catch (err) {
      setToast({ message: err.response?.data?.error || 'Failed to publish teaching periods', type: 'error' });
    }
  };

  const updatePeriodField = (id, key, value) => {
    setPeriods(prev => prev.map(period => (
      period.id === id
        ? { ...period, [key]: key === 'period_number' ? Number(value) : value, ...(key === 'type' || key === 'period_number' ? { code: periodCode(key === 'type' ? value : period.type, key === 'period_number' ? Number(value) : period.period_number) } : {}) }
        : period
    )));
  };

  const toggleSelected = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const removePeriod = async (period) => {
    if (!window.confirm(`Remove ${period.name}?`)) return;
    try {
      await api.delete(`/trimesters/${period.id}`);
      setToast({ message: 'Teaching period removed', type: 'success' });
      setSelectedIds(prev => prev.filter(id => id !== period.id));
      loadData();
    } catch {
      setToast({ message: 'Failed to remove teaching period', type: 'error' });
    }
  };

  return (
    <div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div className="page-header">
        <div>
          <p className="page-kicker">Academic calendar</p>
          <h2 className="page-title">Teaching Period</h2>
          <p className="page-subtitle">Import UniSC teaching periods, review draft dates, then publish approved records.</p>
        </div>
      </div>

      <form onSubmit={importCalendar} className="glass-card p-4 mb-5">
        <div className="grid grid-cols-1 lg:grid-cols-[10rem_1fr_auto] gap-3 items-end">
          <div className="form-group">
            <label className="form-label">Academic Year</label>
            <input className="form-input" type="number" value={importYear} onChange={e => setImportYear(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">UniSC calendar URL</label>
            <input className="form-input" type="url" placeholder="https://www.unisc.edu.au/study/calendars-timetables-and-key-dates/2026-academic-calendar" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} required />
          </div>
          <button className="btn btn-primary" disabled={importing}>{importing ? 'Importing...' : 'Import UniSC Calendar'}</button>
        </div>
      </form>

      <div className="glass-card p-4 mb-5">
        <form onSubmit={addManualPeriod} className="grid grid-cols-1 md:grid-cols-4 xl:grid-cols-8 gap-3 items-end">
          <div className="form-group">
            <label className="form-label">Year</label>
            <input className="form-input" type="number" value={manual.year} onChange={e => setManual({ ...manual, year: e.target.value })} required />
          </div>
          <div className="form-group md:col-span-2">
            <label className="form-label">Name</label>
            <input className="form-input" value={manual.name} onChange={e => setManual({ ...manual, name: e.target.value })} placeholder="Trimester 1, 2026" required />
          </div>
          <div className="form-group">
            <label className="form-label">Type</label>
            <select className="form-select" value={manual.type} onChange={e => setManual({ ...manual, type: e.target.value, code: periodCode(e.target.value, manual.period_number) })}>
              <option value="TRIMESTER">Trimester</option>
              <option value="SESSION">Session</option>
              <option value="SEMESTER">Semester</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">No.</label>
            <input className="form-input" type="number" min="1" max="3" value={manual.period_number} onChange={e => setManual({ ...manual, period_number: Number(e.target.value), code: periodCode(manual.type, Number(e.target.value)) })} />
          </div>
          <div className="form-group">
            <label className="form-label">Start</label>
            <input className="form-input" type="date" value={manual.start_date} onChange={e => setManual({ ...manual, start_date: e.target.value })} required />
          </div>
          <div className="form-group">
            <label className="form-label">End</label>
            <input className="form-input" type="date" value={manual.end_date} onChange={e => setManual({ ...manual, end_date: e.target.value })} required />
          </div>
          <button className="btn btn-secondary">Add Manual Draft</button>
        </form>
      </div>

      <div className="glass-card p-4 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-[18rem_auto] gap-3 items-end">
          <div className="form-group">
            <label className="form-label">Review academic year</label>
            <select className="form-select" value={selectedYearId} onChange={e => setSelectedYearId(e.target.value)}>
              <option value="">All years</option>
              {academicYears.map(year => <option key={year.id} value={year.id}>{year.year} ({year.status})</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={publishSelected} disabled={selectedIds.length === 0}>Publish Selected</button>
        </div>
      </div>

      {loading ? (
        <div className="glass-card p-12 text-center text-surface-400">Loading teaching periods...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table min-w-[1500px]">
            <thead>
              <tr>
                <th>Approve</th>
                <th>Academic year</th>
                {fields.map(([, label]) => <th key={label}>{label}</th>)}
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {visiblePeriods.map(period => (
                <tr key={period.id}>
                  <td>
                    <input type="checkbox" checked={selectedIds.includes(period.id)} onChange={() => toggleSelected(period.id)} />
                  </td>
                  <td>{period.academic_year || '-'}</td>
                  {fields.map(([key]) => (
                    <td key={key}>
                      {key === 'type' ? (
                        <select className="form-select min-w-32" value={period.type || 'TRIMESTER'} onChange={e => updatePeriodField(period.id, key, e.target.value)}>
                          <option value="TRIMESTER">Trimester</option>
                          <option value="SESSION">Session</option>
                          <option value="SEMESTER">Semester</option>
                          <option value="OTHER">Other</option>
                        </select>
                      ) : key === 'status' ? (
                        <select className="form-select min-w-28" value={period.status || 'draft'} onChange={e => updatePeriodField(period.id, key, e.target.value)}>
                          <option value="draft">draft</option>
                          <option value="reviewed">reviewed</option>
                          <option value="published">published</option>
                          <option value="archived">archived</option>
                        </select>
                      ) : key.includes('date') || key === 'start_date' || key === 'end_date' ? (
                        <input className="form-input min-w-36" type="date" value={period[key]?.slice(0, 10) || ''} onChange={e => updatePeriodField(period.id, key, e.target.value)} />
                      ) : (
                        <input className="form-input min-w-32" value={period[key] || ''} onChange={e => updatePeriodField(period.id, key, e.target.value)} />
                      )}
                    </td>
                  ))}
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-sm btn-secondary" onClick={() => savePeriod(period)}>Save</button>
                      <button className="btn btn-sm btn-danger" onClick={() => removePeriod(period)}>Remove</button>
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
