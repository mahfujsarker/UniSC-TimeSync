/**
 * Tutor Manager Page
 * Tutor details and availability by Academic Year / Teaching Period.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../api/axios';
import Modal from '../../components/Modal';
import Toast from '../../components/Toast';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const TIME_OPTIONS = [];
for (let hour = 8; hour <= 22; hour++) {
  TIME_OPTIONS.push(`${hour.toString().padStart(2, '0')}:00`);
  if (hour < 22) TIME_OPTIONS.push(`${hour.toString().padStart(2, '0')}:30`);
}

function timeLabel(start, end) {
  if (!start && !end) return 'Full Day';
  return `${start || '--:--'} - ${end || '--:--'}`;
}

function buildAvailabilityState(availability = []) {
  return availability.reduce((state, slot) => {
    if (slot.availability_scope === 'YEAR') {
      state.years[String(slot.academic_year_id)] = true;
      return state;
    }

    if (!slot.trimester_id) return state;
    const periodId = String(slot.trimester_id);
    if (!state.periods[periodId]) {
      state.periods[periodId] = { mode: 'FULL', days: {} };
    }

    if (slot.availability_scope === 'PERIOD') {
      state.periods[periodId] = { mode: 'FULL', days: {} };
      return state;
    }

    state.periods[periodId].mode = 'DAYS';
    state.periods[periodId].days[slot.day_of_week] = {
      checked: true,
      start_time: slot.start_time ? String(slot.start_time).slice(0, 5) : '',
      end_time: slot.end_time ? String(slot.end_time).slice(0, 5) : ''
    };
    return state;
  }, { years: {}, periods: {} });
}

function flattenAvailability(state) {
  const year_availability = Object.entries(state.years || {})
    .filter(([, checked]) => checked)
    .map(([yearId]) => yearId);

  const availability = Object.entries(state.periods || {}).map(([trimester_id, period]) => {
    if (period.mode !== 'DAYS') {
      return { trimester_id, full_period: true, days: [] };
    }

    return {
      trimester_id,
      full_period: false,
      days: Object.entries(period.days || {})
        .filter(([, value]) => value.checked)
        .map(([day_of_week, value]) => ({
          day_of_week,
          start_time: value.start_time || null,
          end_time: value.end_time || null
        }))
    };
  }).filter(period => period.full_period || period.days.length > 0);

  return { year_availability, availability };
}

function getStatus(tutor, academicYears, publishedPeriods) {
  const yearIds = new Set((tutor.availability || [])
    .filter(slot => slot.availability_scope === 'YEAR')
    .map(slot => String(slot.academic_year_id)));
  const periodIds = new Set((tutor.availability || [])
    .filter(slot => slot.availability_scope === 'PERIOD' || slot.availability_scope === 'DAY')
    .map(slot => String(slot.trimester_id)));

  if (yearIds.size === 0 && periodIds.size === 0) return { label: 'Not Available', className: 'badge-danger' };
  if (academicYears.length > 0 && yearIds.size >= academicYears.length) {
    return { label: 'Available for full year', className: 'badge-success' };
  }
  if (publishedPeriods.length > 0 && periodIds.size >= publishedPeriods.length) {
    return { label: 'Available for full teaching period', className: 'badge-success' };
  }
  return { label: 'Partially available', className: 'badge-warning' };
}

function TimeSelect({ value, onChange, label }) {
  return (
    <select className="form-select text-xs" value={value || ''} onChange={e => onChange(e.target.value)}>
      <option value="">{label}</option>
      {TIME_OPTIONS.map(time => <option key={time} value={time}>{time}</option>)}
    </select>
  );
}

export default function TutorManager() {
  const [tutors, setTutors] = useState([]);
  const [teachingPeriods, setTeachingPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [savingAvailability, setSavingAvailability] = useState(null);

  const [showTutorModal, setShowTutorModal] = useState(false);
  const [editTutor, setEditTutor] = useState(null);
  const [tutorForm, setTutorForm] = useState({ name: '', email: '' });

  const [expandedTutorId, setExpandedTutorId] = useState('');
  const [expandedYears, setExpandedYears] = useState({});
  const [availabilityDrafts, setAvailabilityDrafts] = useState({});

  const publishedPeriods = useMemo(
    () => teachingPeriods.filter(period => period.status === 'published'),
    [teachingPeriods]
  );

  const academicYearGroups = useMemo(() => {
    const groups = new Map();
    publishedPeriods.forEach(period => {
      if (!period.academic_year_id) return;
      const yearId = String(period.academic_year_id || 'none');
      if (!groups.has(yearId)) {
        groups.set(yearId, {
          id: yearId,
          year: period.academic_year || 'Unassigned',
          periods: []
        });
      }
      groups.get(yearId).periods.push(period);
    });
    return [...groups.values()].sort((a, b) => Number(b.year) - Number(a.year));
  }, [publishedPeriods]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [tRes, trRes] = await Promise.all([
        api.get('/tutors'),
        api.get('/trimesters?status=published')
      ]);
      setTutors(tRes.data);
      setTeachingPeriods(trRes.data);
    } catch {
      setToast({ message: 'Failed to load tutors', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openTutorModal = (tutor = null) => {
    setEditTutor(tutor);
    setTutorForm(tutor ? { name: tutor.name, email: tutor.email } : { name: '', email: '' });
    setShowTutorModal(true);
  };

  const saveTutor = async (e) => {
    e.preventDefault();
    try {
      if (editTutor) {
        await api.put(`/tutors/${editTutor.id}`, tutorForm);
        setToast({ message: 'Tutor updated', type: 'success' });
      } else {
        await api.post('/tutors', tutorForm);
        setToast({ message: 'Tutor created', type: 'success' });
      }
      setShowTutorModal(false);
      fetchData();
    } catch (err) {
      setToast({ message: err.response?.data?.error || 'Failed to save tutor', type: 'error' });
    }
  };

  const deleteTutor = async (id) => {
    if (!window.confirm('Delete this tutor?')) return;
    try {
      await api.delete(`/tutors/${id}`);
      setToast({ message: 'Tutor deleted', type: 'success' });
      fetchData();
    } catch {
      setToast({ message: 'Failed to delete tutor', type: 'error' });
    }
  };

  const toggleTutor = (tutor) => {
    const nextId = expandedTutorId === tutor.id ? '' : tutor.id;
    setExpandedTutorId(nextId);
    if (nextId && !availabilityDrafts[tutor.id]) {
      setAvailabilityDrafts(prev => ({
        ...prev,
        [tutor.id]: buildAvailabilityState(tutor.availability || [])
      }));
      const firstYear = academicYearGroups[0]?.id;
      if (firstYear) setExpandedYears(prev => ({ ...prev, [`${tutor.id}-${firstYear}`]: true }));
    }
  };

  const updateDraft = (tutorId, updater) => {
    setAvailabilityDrafts(prev => {
      const current = prev[tutorId] || { years: {}, periods: {} };
      return { ...prev, [tutorId]: updater(current) };
    });
  };

  const setYearChecked = (tutorId, yearGroup, checked) => {
    updateDraft(tutorId, current => {
      const years = { ...current.years, [yearGroup.id]: checked };
      const periods = { ...current.periods };
      if (checked) {
        yearGroup.periods.forEach(period => delete periods[String(period.id)]);
      } else {
        delete years[yearGroup.id];
      }
      return { years, periods };
    });
  };

  const setPeriodChecked = (tutorId, periodId, checked) => {
    updateDraft(tutorId, current => {
      const periods = { ...current.periods };
      if (!checked) {
        delete periods[String(periodId)];
      } else if (!periods[String(periodId)]) {
        periods[String(periodId)] = { mode: 'FULL', days: {} };
      }
      return { ...current, periods };
    });
  };

  const setPeriodMode = (tutorId, periodId, mode) => {
    updateDraft(tutorId, current => ({
      ...current,
      periods: {
        ...current.periods,
        [String(periodId)]: {
          ...(current.periods[String(periodId)] || { days: {} }),
          mode,
          days: mode === 'FULL' ? {} : (current.periods[String(periodId)]?.days || {})
        }
      }
    }));
  };

  const setDayChecked = (tutorId, periodId, day, checked) => {
    updateDraft(tutorId, current => {
      const period = current.periods[String(periodId)] || { mode: 'DAYS', days: {} };
      const days = { ...period.days };
      if (!checked) {
        delete days[day];
      } else {
        days[day] = days[day] || { checked: true, start_time: '', end_time: '' };
      }
      return {
        ...current,
        periods: {
          ...current.periods,
          [String(periodId)]: { ...period, mode: 'DAYS', days }
        }
      };
    });
  };

  const setDayTime = (tutorId, periodId, day, field, value) => {
    updateDraft(tutorId, current => {
      const period = current.periods[String(periodId)] || { mode: 'DAYS', days: {} };
      const days = { ...period.days };
      days[day] = { ...(days[day] || { checked: true, start_time: '', end_time: '' }), [field]: value };
      return {
        ...current,
        periods: {
          ...current.periods,
          [String(periodId)]: { ...period, mode: 'DAYS', days }
        }
      };
    });
  };

  const saveAvailability = async (tutorId) => {
    setSavingAvailability(tutorId);
    try {
      await api.put(`/tutor-availability/tutor/${tutorId}`, flattenAvailability(availabilityDrafts[tutorId] || { years: {}, periods: {} }));
      setToast({ message: 'Tutor availability saved. Existing timetable cards will show warnings where attention is needed.', type: 'success' });
      await fetchData();
      setAvailabilityDrafts(prev => {
        const next = { ...prev };
        delete next[tutorId];
        return next;
      });
      setExpandedTutorId('');
    } catch (err) {
      setToast({ message: err.response?.data?.error || 'Failed to save availability', type: 'error' });
    } finally {
      setSavingAvailability(null);
    }
  };

  return (
    <div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div className="page-header">
        <div>
          <p className="page-kicker">Teaching staff</p>
          <h2 className="page-title" style={{ fontFamily: 'var(--font-heading)' }}>Tutor Management</h2>
          <p className="page-subtitle">Manage tutor availability by Academic Year, Teaching Period, day, and time.</p>
        </div>
        <button className="btn btn-primary" onClick={() => openTutorModal()}>
          + Add Tutor
        </button>
      </div>

      {publishedPeriods.length === 0 && !loading && (
        <div className="alert-card alert-warning mb-5">
          Publish Teaching Periods before setting tutor availability.
        </div>
      )}

      <div className="space-y-4">
        {loading ? (
          <div className="glass-card p-12 text-center text-surface-400">Loading tutors...</div>
        ) : tutors.length === 0 ? (
          <div className="empty-state">No tutors found. Create one to begin.</div>
        ) : (
          tutors.map(tutor => {
            const status = getStatus(tutor, academicYearGroups, publishedPeriods);
            const expanded = expandedTutorId === tutor.id;
            const draft = availabilityDrafts[tutor.id] || buildAvailabilityState(tutor.availability || []);

            return (
              <div key={tutor.id} className="glass-card overflow-hidden transition-all duration-200">
                <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="section-title truncate">{tutor.name}</h3>
                      <span className={`badge ${status.className}`}>{status.label}</span>
                    </div>
                    <p className="text-sm text-surface-600">{tutor.email}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button className="btn btn-secondary btn-sm" onClick={() => toggleTutor(tutor)}>
                      {expanded ? 'Hide Availability' : 'Availability'}
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => openTutorModal(tutor)}>Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => deleteTutor(tutor.id)}>Delete</button>
                  </div>
                </div>

                <div className={`grid transition-all duration-200 ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                  <div className="overflow-hidden">
                    <div className="border-t border-white/70 bg-white/35 p-4">
                      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <h4 className="text-sm font-bold text-surface-900">Availability hierarchy</h4>
                          <p className="text-xs text-surface-500">Academic Year covers all periods. Teaching Period covers all weekdays. Day times narrow availability further.</p>
                        </div>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => saveAvailability(tutor.id)}
                          disabled={savingAvailability === tutor.id}
                        >
                          {savingAvailability === tutor.id ? 'Saving...' : 'Save Availability'}
                        </button>
                      </div>

                      <div className="space-y-3">
                        {academicYearGroups.map(yearGroup => {
                          const yearKey = `${tutor.id}-${yearGroup.id}`;
                          const yearExpanded = expandedYears[yearKey] !== false;
                          const yearChecked = Boolean(draft.years[yearGroup.id]);

                          return (
                            <div key={yearGroup.id} className="rounded-lg border border-white/70 bg-white/60">
                              <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                                <label className="flex items-center gap-3 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    className="w-4 h-4 text-brand-blue rounded border-surface-300"
                                    checked={yearChecked}
                                    onChange={e => setYearChecked(tutor.id, yearGroup, e.target.checked)}
                                  />
                                  <span className="text-base font-bold text-surface-900">{yearGroup.year}</span>
                                  {yearChecked && <span className="badge badge-success">Available for full year</span>}
                                </label>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => setExpandedYears(prev => ({ ...prev, [yearKey]: !yearExpanded }))}
                                >
                                  {yearExpanded ? 'Collapse' : 'Expand'}
                                </button>
                              </div>

                              <div className={`grid transition-all duration-200 ${yearExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                                <div className="overflow-hidden">
                                  <div className="space-y-3 border-t border-white/70 p-3">
                                    {yearGroup.periods.map(period => {
                                      const periodId = String(period.id);
                                      const periodState = draft.periods[periodId];
                                      const periodChecked = Boolean(periodState);
                                      const disabledByYear = yearChecked;

                                      return (
                                        <div key={period.id} className={`rounded-md border border-white/70 p-3 ${disabledByYear ? 'bg-surface-100/70 opacity-70' : 'bg-white/65'}`}>
                                          <label className="flex flex-wrap items-center gap-3 cursor-pointer">
                                            <input
                                              type="checkbox"
                                              className="w-4 h-4 text-brand-blue rounded border-surface-300"
                                              checked={disabledByYear || periodChecked}
                                              disabled={disabledByYear}
                                              onChange={e => setPeriodChecked(tutor.id, period.id, e.target.checked)}
                                            />
                                            <span className="font-semibold text-surface-900">{period.name}</span>
                                            <span className="badge bg-surface-200 text-surface-700">{period.code}</span>
                                            {disabledByYear && <span className="badge badge-success">Covered by year</span>}
                                            {!disabledByYear && periodChecked && periodState.mode === 'FULL' && <span className="badge badge-success">Available for full teaching period</span>}
                                            {!disabledByYear && periodChecked && periodState.mode === 'DAYS' && <span className="badge badge-warning">Partially available</span>}
                                          </label>

                                          {!disabledByYear && periodChecked && (
                                            <div className="mt-3">
                                              <div className="mb-3 inline-flex rounded-lg border border-white/70 bg-white/70 p-1">
                                                <button
                                                  type="button"
                                                  className={`px-3 py-1.5 text-xs font-bold rounded-md ${periodState.mode === 'FULL' ? 'bg-brand-blue text-white' : 'text-surface-600 hover:bg-white'}`}
                                                  onClick={() => setPeriodMode(tutor.id, period.id, 'FULL')}
                                                >
                                                  Full teaching period
                                                </button>
                                                <button
                                                  type="button"
                                                  className={`px-3 py-1.5 text-xs font-bold rounded-md ${periodState.mode === 'DAYS' ? 'bg-brand-blue text-white' : 'text-surface-600 hover:bg-white'}`}
                                                  onClick={() => setPeriodMode(tutor.id, period.id, 'DAYS')}
                                                >
                                                  Limit by days
                                                </button>
                                              </div>

                                              {periodState.mode === 'DAYS' && (
                                                <div className="grid grid-cols-1 gap-2 xl:grid-cols-5">
                                                  {DAYS.map(day => {
                                                    const dayState = periodState.days?.[day];
                                                    const dayChecked = Boolean(dayState?.checked);
                                                    return (
                                                      <div key={day} className="rounded-md border border-white/70 bg-white/65 p-2">
                                                        <label className="mb-2 flex items-center gap-2 cursor-pointer">
                                                          <input
                                                            type="checkbox"
                                                            className="w-4 h-4 text-brand-blue rounded border-surface-300"
                                                            checked={dayChecked}
                                                            onChange={e => setDayChecked(tutor.id, period.id, day, e.target.checked)}
                                                          />
                                                          <span className="text-sm font-semibold text-surface-800">{day}</span>
                                                        </label>
                                                        {dayChecked && (
                                                          <div className="space-y-2">
                                                            <div className="grid grid-cols-2 gap-2">
                                                              <TimeSelect
                                                                label="Full day"
                                                                value={dayState?.start_time || ''}
                                                                onChange={value => setDayTime(tutor.id, period.id, day, 'start_time', value)}
                                                              />
                                                              <TimeSelect
                                                                label="Full day"
                                                                value={dayState?.end_time || ''}
                                                                onChange={value => setDayTime(tutor.id, period.id, day, 'end_time', value)}
                                                              />
                                                            </div>
                                                            <div className="rounded bg-white/70 px-2 py-1 text-[10px] font-semibold text-surface-500">
                                                              {timeLabel(dayState?.start_time, dayState?.end_time)}
                                                            </div>
                                                          </div>
                                                        )}
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Modal isOpen={showTutorModal} onClose={() => setShowTutorModal(false)} title={editTutor ? 'Edit Tutor' : 'New Tutor'}>
        <form onSubmit={saveTutor} className="space-y-4">
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className="form-input" required placeholder="Dr. Jane Doe" value={tutorForm.name} onChange={e => setTutorForm({ ...tutorForm, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" required placeholder="jane.doe@uni.edu" value={tutorForm.email} onChange={e => setTutorForm({ ...tutorForm, email: e.target.value })} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn btn-primary flex-1">{editTutor ? 'Update' : 'Create'}</button>
            <button type="button" onClick={() => setShowTutorModal(false)} className="btn btn-secondary">Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
