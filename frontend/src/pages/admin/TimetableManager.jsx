/**
 * Timetable Manager Page — Card-based Unit Management with Class Generation
 * Degree + Trimester selection loads all available units as cards.
 * Per-unit and global class generation support.
 */
import { useState, useEffect, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import api from '../../api/axios';
import Modal from '../../components/Modal';
import Toast from '../../components/Toast';
import KanbanBoard from '../../components/KanbanBoard';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const TIME_SLOTS = [];
for (let hour = 8; hour < 22; hour++) {
  TIME_SLOTS.push(`${hour.toString().padStart(2, '0')}:00`);
  TIME_SLOTS.push(`${hour.toString().padStart(2, '0')}:30`);
}

const DAY_COLORS = {
  Monday: '#6366f1',
  Tuesday: '#8b5cf6',
  Wednesday: '#06b6d4',
  Thursday: '#f59e0b',
  Friday: '#10b981',
};

export default function TimetableManager() {
  const [degrees, setDegrees] = useState([]);
  const [trimesters, setTrimesters] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [tutors, setTutors] = useState([]);
  
  const [selectedDegree, setSelectedDegree] = useState('');
  const [selectedTrimester, setSelectedTrimester] = useState('');
  
  const [units, setUnits] = useState([]);
  const [classes, setClasses] = useState([]);
  const [scheduledEntries, setScheduledEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generatingUnit, setGeneratingUnit] = useState(null);

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({
    class_id: '',
    unit_id: '',
    classroom_id: '',
    tutor_id: '',
    day_of_week: 'Monday',
    start_time: '09:00',
    end_time: '10:00',
    create_recurring: true
  });
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/degrees'),
      api.get('/trimesters'),
      api.get('/classrooms'),
      api.get('/tutors'),
    ]).then(([d, tr, c, t]) => {
      setDegrees(d.data);
      setTrimesters(tr.data);
      setClassrooms(c.data.filter(cl => cl.is_available));
      setTutors(t.data);
      
      if (d.data.length > 0) {
        setSelectedDegree(d.data[0].id);
      }
      if (tr.data.length > 0) {
        setSelectedTrimester(tr.data[0].id);
      }
    }).catch(() => {});
  }, []);

  const loadUnits = useCallback(async () => {
    if (!selectedTrimester) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedDegree) params.append('degree_id', selectedDegree);
      params.append('trimester_id', selectedTrimester);
      
      const res = await api.get(`/units/by-degree?${params.toString()}`);
      setUnits(res.data);
    } catch {
      setToast({ message: 'Failed to load units', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [selectedTrimester, selectedDegree]);

  const loadClasses = useCallback(async () => {
    if (!selectedTrimester) return;
    try {
      const params = new URLSearchParams({ trimester_id: selectedTrimester });
      if (selectedDegree) params.append('degree_id', selectedDegree);
      
      const res = await api.get(`/classes?${params.toString()}`);
      setClasses(res.data);
    } catch {
      setToast({ message: 'Failed to load classes', type: 'error' });
    }
  }, [selectedTrimester, selectedDegree]);

  const loadScheduledEntries = useCallback(async () => {
    if (!selectedTrimester) return;
    try {
      const params = new URLSearchParams({ trimester_id: selectedTrimester });
      if (selectedDegree) params.append('degree_id', selectedDegree);
      
      const res = await api.get(`/timetable?${params.toString()}`);
      setScheduledEntries(res.data);
    } catch {
      setToast({ message: 'Failed to load scheduled entries', type: 'error' });
    }
  }, [selectedTrimester, selectedDegree]);

  useEffect(() => { 
    if (selectedTrimester) {
      loadUnits();
      loadClasses();
      loadScheduledEntries();
    }
  }, [loadUnits, loadClasses, loadScheduledEntries, selectedTrimester]);

  const handleDegreeChange = (degreeId) => {
    setSelectedDegree(degreeId);
  };

  const handleTrimesterChange = (trimesterId) => {
    setSelectedTrimester(trimesterId);
  };

  const handleGenerateClass = async (unitId) => {
    if (!selectedTrimester) return;
    setGeneratingUnit(unitId);
    try {
      await api.post('/classes', { unit_id: unitId, trimester_id: selectedTrimester });
      setToast({ message: 'Class generated successfully', type: 'success' });
      loadUnits();
      loadClasses();
    } catch (err) {
      if (err.response?.status === 409) {
        setToast({ message: 'Classes already exist for this unit', type: 'error' });
      } else {
        setToast({ message: err.response?.data?.error || 'Failed to generate class', type: 'error' });
      }
    } finally {
      setGeneratingUnit(null);
    }
  };

  const handleGenerateAllClasses = async () => {
    if (!selectedTrimester) return;
    setLoading(true);
    try {
      const body = { trimester_id: selectedTrimester };
      if (selectedDegree) body.degree_id = selectedDegree;
      
      const res = await api.post('/classes/batch', body);
      setToast({ message: res.data.message, type: 'success' });
      loadUnits();
      loadClasses();
    } catch (err) {
      setToast({ message: err.response?.data?.error || 'Failed to generate classes', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const getUnitClasses = (unitId) => {
    return classes.filter(c => c.unit_id === unitId);
  };

  const hasClassesForUnit = (unitId) => {
    return classes.some(c => c.unit_id === unitId);
  };

  const isUnitForSelectedDegree = (unit) => {
    if (!selectedDegree) return true;
    return (unit.degrees || []).some(d => d.id === parseInt(selectedDegree));
  };

  const handleEntryClick = (entry) => {
    setEditingEntry(entry);
    setScheduleForm({
      class_id: entry.class_id,
      unit_id: entry.unit_id,
      classroom_id: entry.classroom_id,
      tutor_id: entry.tutor_id,
      day_of_week: entry.day_of_week,
      start_time: entry.start_time?.substring(0, 5),
      end_time: entry.end_time?.substring(0, 5),
      create_recurring: entry.is_recurring
    });
    setShowScheduleModal(true);
  };

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const formData = {
        ...scheduleForm,
        trimester_id: selectedTrimester,
        start_time: scheduleForm.start_time + ':00',
        end_time: scheduleForm.end_time + ':00'
      };

      if (editingEntry) {
        await api.put(`/timetable/${editingEntry.id}`, formData);
        setToast({ message: 'Entry updated', type: 'success' });
      } else {
        await api.post('/timetable/schedule', formData);
        setToast({ message: 'Class scheduled successfully', type: 'success' });
      }

      setShowScheduleModal(false);
      loadScheduledEntries();
    } catch (e) {
      const conflicts = e.response?.data?.conflicts;
      if (conflicts?.length > 0) {
        const conflictMsgs = conflicts.map(c => c.message).join('; ');
        setToast({ message: `Conflict: ${conflictMsgs}`, type: 'error' });
      } else {
        setToast({ message: e.response?.data?.error || 'Failed to save', type: 'error' });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingEntry || !window.confirm('Delete this timetable entry?')) return;
    try {
      await api.delete(`/timetable/${editingEntry.id}`);
      setToast({ message: 'Entry deleted', type: 'success' });
      setShowScheduleModal(false);
      loadScheduledEntries();
    } catch {
      setToast({ message: 'Delete failed', type: 'error' });
    }
  };

  const handleKanbanDragEnd = async (result) => {
    const { source, destination, draggableId } = result;
    
    if (!destination) return;

    if (source.droppableId === 'class-pool' && destination.droppableId.startsWith('slot-')) {
      const classId = draggableId.replace('pool-', '');
      const classData = classes.find(c => c.id === parseInt(classId));
      if (!classData) return;

      const [day, time] = destination.droppableId.replace('slot-', '').split('|');
      const duration = classData.duration || 1;
      const [hours, mins] = time.split(':').map(Number);
      const endHours = hours + duration;

      setScheduleForm({
        class_id: classData.id,
        unit_id: classData.unit_id,
        classroom_id: '',
        tutor_id: '',
        day_of_week: day,
        start_time: time,
        end_time: `${endHours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`,
        create_recurring: true
      });
      setEditingEntry(null);
      setShowScheduleModal(true);
    }
  };

  const scheduledClasses = classes.filter(cls => 
    scheduledEntries.some(entry => entry.class_id === cls.id)
  );

  const unscheduledClasses = classes.filter(cls => 
    !scheduledEntries.some(entry => entry.class_id === cls.id)
  );

  const groupedScheduled = scheduledEntries.reduce((acc, entry) => {
    const day = entry.day_of_week;
    if (!acc[day]) acc[day] = [];
    acc[day].push(entry);
    return acc;
  }, {});

  return (
    <div className="min-h-screen">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-surface-900" style={{ fontFamily: 'var(--font-heading)' }}>
          Timetable Manager
        </h2>
        <button 
          onClick={() => { loadUnits(); loadClasses(); loadScheduledEntries(); }} 
          className="btn btn-sm btn-secondary"
          disabled={loading}
        >
          {loading ? 'Loading...' : '↻ Refresh'}
        </button>
      </div>

      <div className="bg-white rounded-lg border border-surface-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="form-group">
            <label className="form-label">Degree</label>
            <select 
              className="form-select" 
              value={selectedDegree} 
              onChange={e => handleDegreeChange(e.target.value)}
            >
              <option value="">All Degrees</option>
              {degrees.map(d => (
                <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Trimester</label>
            <select 
              className="form-select" 
              value={selectedTrimester} 
              onChange={e => handleTrimesterChange(e.target.value)}
            >
              <option value="">Select trimester...</option>
              {trimesters.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {!selectedTrimester ? (
        <div className="bg-white rounded-lg border border-surface-200 p-12 text-center">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-surface-500">Select a degree and trimester to manage the timetable</p>
        </div>
      ) : loading ? (
        <div className="bg-white rounded-lg border border-surface-200 p-12 text-center text-surface-400">
          Loading...
        </div>
      ) : (
        <>
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-surface-900">Units</h3>
              <button 
                onClick={handleGenerateAllClasses}
                className="btn btn-primary btn-sm"
                disabled={loading || units.every(u => hasClassesForUnit(u.id))}
              >
                Generate Classes for All Units
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {units.map(unit => {
                const isForDegree = isUnitForSelectedDegree(unit);
                const hasClasses = hasClassesForUnit(unit.id);
                const unitClasses = getUnitClasses(unit.id);
                const otherDegrees = (unit.degrees || []).filter(d => d.id !== parseInt(selectedDegree));
                
                return (
                  <div 
                    key={unit.id}
                    className={`card ${!isForDegree ? 'opacity-50' : ''} ${hasClasses ? 'border-green-300 bg-green-50/30' : ''}`}
                  >
                    <div className="card-body">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <span className="badge bg-[#e6eeff] text-[#0044a3] text-xs">{unit.code}</span>
                          <h4 className="font-semibold text-surface-900 mt-1">{unit.name}</h4>
                        </div>
                        <span className={`badge ${unit.classroom_type === 'lab' ? 'badge-warning' : 'badge-primary'} text-xs`}>
                          {unit.classroom_type === 'lab' ? 'Lab' : 'Normal'}
                        </span>
                      </div>
                      
                      {otherDegrees.length > 0 && (
                        <div className="text-xs text-surface-500 mb-2">
                          Also used in: {otherDegrees.map(d => d.code).join(', ')}
                        </div>
                      )}
                      
                      <div className="text-xs text-surface-600 mb-3">
                        <span>Est. students: {unit.total_students}</span>
                        <span className="mx-2">•</span>
                        <span>{unit.class_duration}h class</span>
                        {hasClasses && (
                          <>
                            <span className="mx-2">•</span>
                            <span className="text-success font-medium">{unitClasses.length} class{unitClasses.length > 1 ? 'es' : ''}</span>
                          </>
                        )}
                      </div>
                      
                      {hasClasses ? (
                        <div className="flex items-center gap-2 text-sm text-success">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Class Generated</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleGenerateClass(unit.id)}
                          className="btn btn-primary btn-sm w-full"
                          disabled={generatingUnit === unit.id || !isForDegree}
                        >
                          {generatingUnit === unit.id ? 'Generating...' : 'Generate Class'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {units.length === 0 && (
                <div className="col-span-full text-center py-8 text-surface-500">
                  No units found for this selection
                </div>
              )}
            </div>
          </div>

          {scheduledClasses.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-surface-900 mb-4">Scheduled Classes</h3>
              <KanbanBoard 
                data={groupedScheduled} 
                onCardClick={handleEntryClick}
                readOnly={true}
              />
            </div>
          )}

          {unscheduledClasses.length > 0 && (
            <div className="bg-white rounded-lg border border-surface-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-surface-900">Unscheduled Classes</h3>
                <span className="badge badge-warning">{unscheduledClasses.length}</span>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {unscheduledClasses.map(cls => (
                  <div
                    key={cls.id}
                    className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 cursor-pointer hover:bg-blue-100 transition-colors"
                    onClick={() => {
                      const duration = cls.duration || 1;
                      setScheduleForm({
                        class_id: cls.id,
                        unit_id: cls.unit_id,
                        classroom_id: '',
                        tutor_id: '',
                        day_of_week: 'Monday',
                        start_time: '09:00',
                        end_time: `${(9 + duration).toString().padStart(2, '0')}:00`,
                        create_recurring: true
                      });
                      setEditingEntry(null);
                      setShowScheduleModal(true);
                    }}
                  >
                    <span className="text-xs font-semibold text-blue-800">{cls.unit_code}</span>
                    <span className="text-xs text-blue-600">{cls.group_name}</span>
                    <span className="text-xs text-blue-400">({cls.duration}h)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <Modal 
        isOpen={showScheduleModal} 
        onClose={() => setShowScheduleModal(false)} 
        title={editingEntry ? 'Edit Timetable Entry' : 'Schedule Class'}
        size="lg"
      >
        <form onSubmit={handleScheduleSubmit} className="space-y-4">
          <div className="form-group">
            <label className="form-label">Classroom</label>
            <select 
              className="form-select" 
              value={scheduleForm.classroom_id}
              onChange={e => setScheduleForm(prev => ({ ...prev, classroom_id: e.target.value }))}
              required
            >
              <option value="">Select room...</option>
              {classrooms.map(c => (
                <option key={c.id} value={c.id}>
                  {c.room_number} ({c.type}, cap: {c.max_capacity})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Tutor</label>
            <select 
              className="form-select" 
              value={scheduleForm.tutor_id}
              onChange={e => setScheduleForm(prev => ({ ...prev, tutor_id: e.target.value }))}
              required
            >
              <option value="">Select tutor...</option>
              {tutors.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Day</label>
            <select 
              className="form-select" 
              value={scheduleForm.day_of_week}
              onChange={e => setScheduleForm(prev => ({ ...prev, day_of_week: e.target.value }))}
              required
            >
              {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Start Time</label>
              <input 
                type="time" 
                step="1800" 
                min="08:00" 
                max="22:00"
                className="form-input" 
                value={scheduleForm.start_time}
                onChange={e => setScheduleForm(prev => ({ ...prev, start_time: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">End Time</label>
              <input 
                type="time" 
                step="1800" 
                min="08:00" 
                max="22:00"
                className="form-input" 
                value={scheduleForm.end_time}
                onChange={e => setScheduleForm(prev => ({ ...prev, end_time: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                className="w-4 h-4 rounded border-surface-300"
                checked={scheduleForm.create_recurring}
                onChange={e => setScheduleForm(prev => ({ ...prev, create_recurring: e.target.checked }))}
              />
              <span className="text-sm text-surface-600">Schedule as recurring (all weeks)</span>
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn btn-primary flex-1" disabled={saving}>
              {saving ? 'Saving...' : editingEntry ? 'Update' : 'Schedule'}
            </button>
            {editingEntry && (
              <button type="button" onClick={handleDelete} className="btn btn-danger">
                Delete
              </button>
            )}
            <button type="button" onClick={() => setShowScheduleModal(false)} className="btn btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
