/**
 * Tutor Manager Page
 * Tutor details and availability by published Teaching Period.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../api/axios';
import Modal from '../../components/Modal';
import Toast from '../../components/Toast';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function timeLabel(start, end) {
  if (!start && !end) return 'Full Day';
  return `${String(start).slice(0, 5)} - ${String(end).slice(0, 5)}`;
}

function buildAvailabilityState(availability = []) {
  return availability.reduce((state, slot) => {
    const periodId = String(slot.trimester_id);
    if (!state[periodId]) state[periodId] = {};
    state[periodId][slot.day_of_week] = {
      checked: true,
      start_time: slot.start_time ? String(slot.start_time).slice(0, 5) : '',
      end_time: slot.end_time ? String(slot.end_time).slice(0, 5) : ''
    };
    return state;
  }, {});
}

function flattenAvailability(state) {
  return Object.entries(state).map(([trimester_id, days]) => ({
    trimester_id,
    days: Object.entries(days)
      .filter(([, value]) => value.checked)
      .map(([day_of_week, value]) => ({
        day_of_week,
        start_time: value.start_time || null,
        end_time: value.end_time || null
      }))
  })).filter(period => period.days.length > 0);
}

function getStatus(tutor, publishedPeriods) {
  const periodIds = new Set((tutor.availability || []).map(slot => String(slot.trimester_id)));
  if (periodIds.size === 0) return { label: 'Not Available', className: 'badge-danger' };
  if (periodIds.size >= publishedPeriods.length && publishedPeriods.length > 0) {
    return { label: 'Available', className: 'badge-success' };
  }
  return { label: 'Partially Available', className: 'badge-warning' };
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
  const [availabilityDrafts, setAvailabilityDrafts] = useState({});

  const publishedPeriods = useMemo(
    () => teachingPeriods.filter(period => period.status === 'published'),
    [teachingPeriods]
  );

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [tRes, trRes] = await Promise.all([
        api.get('/tutors'),
        api.get('/trimesters')
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
    }
  };

  const setPeriodChecked = (tutorId, periodId, checked) => {
    setAvailabilityDrafts(prev => {
      const tutorState = { ...(prev[tutorId] || {}) };
      if (!checked) {
        delete tutorState[String(periodId)];
      } else if (!tutorState[String(periodId)]) {
        tutorState[String(periodId)] = {};
      }
      return { ...prev, [tutorId]: tutorState };
    });
  };

  const setDayChecked = (tutorId, periodId, day, checked) => {
    setAvailabilityDrafts(prev => {
      const tutorState = { ...(prev[tutorId] || {}) };
      const periodState = { ...(tutorState[String(periodId)] || {}) };
      if (!checked) {
        delete periodState[day];
      } else {
        periodState[day] = periodState[day] || { checked: true, start_time: '', end_time: '' };
      }
      tutorState[String(periodId)] = periodState;
      return { ...prev, [tutorId]: tutorState };
    });
  };

  const setDayTime = (tutorId, periodId, day, field, value) => {
    setAvailabilityDrafts(prev => {
      const tutorState = { ...(prev[tutorId] || {}) };
      const periodState = { ...(tutorState[String(periodId)] || {}) };
      periodState[day] = { ...(periodState[day] || { checked: true, start_time: '', end_time: '' }), [field]: value };
      tutorState[String(periodId)] = periodState;
      return { ...prev, [tutorId]: tutorState };
    });
  };

  const saveAvailability = async (tutorId) => {
    setSavingAvailability(tutorId);
    try {
      await api.put(`/tutor-availability/tutor/${tutorId}`, {
        availability: flattenAvailability(availabilityDrafts[tutorId] || {})
      });
      setToast({ message: 'Tutor availability saved', type: 'success' });
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
          <p className="page-subtitle">Manage tutors and their availability across published Teaching Periods.</p>
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
            const status = getStatus(tutor, publishedPeriods);
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
                    <div className="mt-2 flex flex-wrap gap-1">
                      {Object.entries((tutor.availability || []).reduce((grouped, slot) => {
                        grouped[slot.trimester_id] = slot.trimester_name;
                        return grouped;
                      }, {})).slice(0, 4).map(([periodId, name]) => (
                        <span key={periodId} className="bg-[#e6eeff] text-[#0044a3] px-2 py-0.5 rounded text-[10px] font-bold">{name}</span>
                      ))}
                    </div>
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
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-bold text-surface-900">Availability by Teaching Period</h4>
                          <p className="text-xs text-surface-500">Checked days with no time set count as full-day availability.</p>
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
                        {publishedPeriods.map(period => {
                          const periodId = String(period.id);
                          const periodChecked = Boolean(draft[periodId]);
                          return (
                            <div key={period.id} className="rounded-lg border border-white/70 bg-white/60 p-3">
                              <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="w-4 h-4 text-brand-blue rounded border-surface-300"
                                  checked={periodChecked}
                                  onChange={e => setPeriodChecked(tutor.id, period.id, e.target.checked)}
                                />
                                <span className="font-semibold text-surface-900">{period.name}</span>
                                <span className="badge bg-surface-200 text-surface-700">{period.code}</span>
                              </label>

                              {periodChecked && (
                                <div className="mt-3 grid grid-cols-1 gap-2 xl:grid-cols-5">
                                  {DAYS.map(day => {
                                    const dayState = draft[periodId]?.[day];
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
                                          <div className="grid grid-cols-2 gap-2">
                                            <input
                                              type="time"
                                              min="08:00"
                                              max="22:00"
                                              step="1800"
                                              className="form-input text-xs"
                                              value={dayState?.start_time || ''}
                                              onChange={e => setDayTime(tutor.id, period.id, day, 'start_time', e.target.value)}
                                              title="Leave blank for full-day availability"
                                            />
                                            <input
                                              type="time"
                                              min="08:00"
                                              max="22:00"
                                              step="1800"
                                              className="form-input text-xs"
                                              value={dayState?.end_time || ''}
                                              onChange={e => setDayTime(tutor.id, period.id, day, 'end_time', e.target.value)}
                                              title="Leave blank for full-day availability"
                                            />
                                            <div className="col-span-2 text-[10px] font-semibold text-surface-500">
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
