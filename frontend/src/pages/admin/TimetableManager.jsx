/**
 * Timetable Manager Page — Global University Scheduler
 * Master timetable with unit cards, Generate buttons, and fully draggable class placement.
 */
import { useState, useEffect, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import api from '../../api/axios';
import Modal from '../../components/Modal';
import Toast from '../../components/Toast';

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
  const [selectedClassForMove, setSelectedClassForMove] = useState(null);

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

  const loadScheduledEntries = useCallback(async () => {
    if (!selectedTrimester) return;
    try {
      const params = new URLSearchParams({ trimester_id: selectedTrimester });
      const res = await api.get(`/timetable?${params.toString()}`);
      setScheduledEntries(res.data);
    } catch {
      console.error('Failed to load scheduled entries');
    }
  }, [selectedTrimester]);

  useEffect(() => { loadUnits(); }, [loadUnits]);
  useEffect(() => { loadScheduledEntries(); }, [loadScheduledEntries]);

  const handleGenerateClass = async (unitId) => {
    if (!selectedTrimester) {
      setToast({ message: 'Please select a trimester first', type: 'error' });
      return;
    }
    
    setGeneratingUnit(unitId);
    try {
      const unit = units.find(u => u.id === unitId);
      const numClasses = Math.ceil((unit?.total_students || 0) / (unit?.classroom_type === 'lab' ? 25 : 30));
      
      const createdClasses = [];
      for (let i = 0; i < numClasses; i++) {
        const letter = String.fromCharCode(65 + i);
        const groupName = `Group ${letter}`;
        
        const classRes = await api.post('/classes', {
          unit_id: unitId,
          trimester_id: selectedTrimester,
          group_name: groupName,
          required_room_type: unit?.classroom_type || 'normal',
          duration: unit?.class_duration || 1,
          max_capacity: unit?.classroom_type === 'lab' ? 25 : 30
        });
        
        const newClass = classRes.data;
        createdClasses.push(newClass);
        
        const assigned = await autoScheduleClass(newClass, unit);
        if (assigned) {
          await loadScheduledEntries();
        }
      }
      
      setToast({ 
        message: `${createdClasses.length} class(es) generated and scheduled`, 
        type: 'success' 
      });
      loadUnits();
    } catch (err) {
      setToast({ message: err.response?.data?.error || 'Failed to generate classes', type: 'error' });
    } finally {
      setGeneratingUnit(null);
    }
  };

  const autoScheduleClass = async (cls, unit) => {
    const suitableRooms = classrooms.filter(r => r.type === (unit?.classroom_type || 'normal'));
    if (suitableRooms.length === 0) {
      setToast({ message: 'No suitable room available', type: 'warning' });
      return false;
    }
    
    const room = suitableRooms[0];
    const tutor = tutors[0];
    
    if (!tutor) {
      setToast({ message: 'No tutor available for auto-scheduling', type: 'warning' });
      return false;
    }
    
    for (const day of DAYS) {
      for (let i = 0; i < TIME_SLOTS.length - 1; i++) {
        const startTime = TIME_SLOTS[i];
        const duration = cls.duration || unit?.class_duration || 1;
        const endHour = parseInt(startTime.split(':')[0]) + duration;
        const endTime = `${endHour.toString().padStart(2, '0')}:00`;
        
        if (endHour > 22) continue;
        
        try {
          const res = await api.post('/timetable/check-conflicts', {
            class_id: cls.id,
            classroom_id: room.id,
            tutor_id: tutor.id,
            day_of_week: day,
            start_time: startTime,
            end_time: endTime
          });
          
          if (res.data.valid) {
            await api.post('/timetable/schedule', {
              class_id: cls.id,
              unit_id: cls.unit_id,
              classroom_id: room.id,
              tutor_id: tutor.id,
              trimester_id: selectedTrimester,
              day_of_week: day,
              start_time: startTime,
              end_time: endTime,
              create_recurring: true
            });
            return true;
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    setToast({ message: 'Could not auto-schedule. Please manually assign.', type: 'warning' });
    return false;
  };

  const handleGenerateAll = async () => {
    if (!selectedTrimester) {
      setToast({ message: 'Please select a trimester first', type: 'error' });
      return;
    }
    
    setGeneratingUnit('all');
    try {
      let generated = 0;
      
      for (const unit of units) {
        if ((unit.total_students || 0) === 0) continue;
        
        const numClasses = Math.ceil(unit.total_students / (unit.classroom_type === 'lab' ? 25 : 30));
        
        for (let i = 0; i < numClasses; i++) {
          const letter = String.fromCharCode(65 + i);
          const groupName = `Group ${letter}`;
          
          try {
            const classRes = await api.post('/classes', {
              unit_id: unit.id,
              trimester_id: selectedTrimester,
              group_name: groupName,
              required_room_type: unit.classroom_type,
              duration: unit.class_duration || 1,
              max_capacity: unit.classroom_type === 'lab' ? 25 : 30
            });
            
            await autoScheduleClass(classRes.data, unit);
            generated++;
          } catch {
            continue;
          }
        }
      }
      
      setToast({ message: `${generated} class(es) generated and scheduled`, type: 'success' });
      loadUnits();
      loadScheduledEntries();
    } catch (err) {
      setToast({ message: err.response?.data?.error || 'Failed to generate classes', type: 'error' });
    } finally {
      setGeneratingUnit(null);
    }
  };

  const handleMoveClass = async (entryId, newDay, newStartTime) => {
    const entry = scheduledEntries.find(e => e.id === entryId);
    if (!entry) return;
    
    const originalDuration = entry.class_duration || 1;
    const [hour, minute] = newStartTime.split(':').map(Number);
    const endHour = hour + originalDuration;
    const newEndTime = `${endHour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`;
    const formattedStartTime = `${newStartTime}:00`;
    
    try {
      await api.put(`/timetable/${entryId}`, {
        day_of_week: newDay,
        start_time: formattedStartTime,
        end_time: newEndTime
      });
      
      setToast({ message: 'Class moved', type: 'success' });
      loadScheduledEntries();
    } catch (err) {
      const conflicts = err.response?.data?.conflicts;
      if (conflicts?.length > 0) {
        setToast({ message: `Conflict: ${conflicts[0].message}`, type: 'error' });
      } else {
        setToast({ message: err.response?.data?.error || 'Failed to move class', type: 'error' });
      }
      loadScheduledEntries();
    }
  };

  const handleTimeSlotClick = (day, timeSlot) => {
    if (selectedClassForMove) {
      handleMoveClass(selectedClassForMove.id, day, timeSlot);
      setSelectedClassForMove(null);
    }
  };

  const handleDragEnd = (result) => {
    const { draggableId, destination } = result;
    if (!destination) return;
    
    const [day, timeSlot] = destination.droppableId.split('|');
    if (!day || !timeSlot || !DAYS.includes(day)) return;
    
    handleMoveClass(draggableId, day, timeSlot);
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
        setToast({ message: 'Class scheduled', type: 'success' });
      }

      setShowScheduleModal(false);
      loadScheduledEntries();
      loadUnits();
    } catch (err) {
      const conflicts = err.response?.data?.conflicts;
      if (conflicts?.length > 0) {
        setToast({ message: `Conflict: ${conflicts[0].message}`, type: 'error' });
      } else {
        setToast({ message: err.response?.data?.error || 'Failed to save', type: 'error' });
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

  const calculateCardStyle = (entry) => {
    const startParts = entry.start_time.split(':');
    const endParts = entry.end_time.split(':');
    const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
    const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);
    const baseOffset = 8 * 60;
    const startSlot = (startMinutes - baseOffset) / 30;
    const durationSlots = (endMinutes - startMinutes) / 30;
    const slotHeight = 48;
    return { top: startSlot * slotHeight, height: durationSlots * slotHeight - 4 };
  };

  const getEntriesForDay = (day) => {
    return scheduledEntries.filter(entry => entry.day_of_week === day);
  };

  const getScheduledCountForUnit = (unitId) => {
    return scheduledEntries.filter(e => e.unit_id === unitId).length;
  };

  const roomTypeLabel = (type) => type === 'lab' ? 'Lab' : 'Normal';

  return (
    <div className="min-h-screen">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-surface-900" style={{ fontFamily: 'var(--font-heading)' }}>
          📅 Timetable Scheduler
        </h2>
        <button 
          onClick={() => { loadUnits(); loadScheduledEntries(); }} 
          className="btn btn-sm btn-secondary"
          disabled={loading}
        >
          ↻ Refresh
        </button>
      </div>

      <div className="bg-white rounded-lg border border-surface-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="form-group">
            <label className="form-label">Select Degree (Filter)</label>
            <select 
              className="form-select" 
              value={selectedDegree} 
              onChange={e => setSelectedDegree(e.target.value)}
            >
              <option value="">All Degrees</option>
              {degrees.map(d => (
                <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Select Trimester / Session</label>
            <select 
              className="form-select" 
              value={selectedTrimester} 
              onChange={e => setSelectedTrimester(e.target.value)}
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
          <p className="text-surface-500">Select a trimester to manage the timetable</p>
        </div>
      ) : (
        <>
          <div className="flex gap-4 mb-6">
            <div className="w-80 flex-shrink-0">
              <div className="bg-white rounded-lg border border-surface-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm text-surface-900">Units</h3>
                  <button 
                    onClick={handleGenerateAll}
                    className="btn btn-sm btn-primary"
                    disabled={generatingUnit === 'all' || loading || units.length === 0}
                  >
                    {generatingUnit === 'all' ? 'Generating...' : 'Generate All'}
                  </button>
                </div>

                {loading ? (
                  <div className="text-center py-6 text-surface-400 text-sm">Loading units...</div>
                ) : units.length === 0 ? (
                  <div className="text-center py-6 text-surface-500 text-sm">No units for selected filters</div>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                    {units.map(unit => {
                      const scheduledCount = getScheduledCountForUnit(unit.id);
                      const numClasses = Math.ceil((unit.total_students || 0) / (unit.classroom_type === 'lab' ? 25 : 30));
                      const hasClasses = scheduledCount > 0;
                      
                      return (
                        <div 
                          key={unit.id}
                          className={`border rounded-md p-3 ${hasClasses ? 'bg-surface-50 border-surface-300' : 'border-surface-200'}`}
                        >
                          <div className="flex items-start justify-between mb-1">
                            <div>
                              <span className="font-bold text-xs text-surface-900">{unit.code}</span>
                              <span className="text-xs text-surface-500 ml-2">{unit.name}</span>
                            </div>
                            <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${unit.classroom_type === 'lab' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                              {roomTypeLabel(unit.classroom_type)}
                            </span>
                          </div>
                          
                          <div className="text-[10px] text-surface-500 mb-2">
                            <span>Students: {unit.total_students || 0}</span>
                            <span className="ml-2">•</span>
                            <span className="ml-2">
                              {hasClasses 
                                ? `Classes: ${scheduledCount}/${numClasses}` 
                                : `Est. classes: ${numClasses}`}
                            </span>
                          </div>
                          
                          {hasClasses ? (
                            <div className="flex items-center gap-2 text-sm text-success">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                              </svg>
                              <span>✓ Generated</span>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleGenerateClass(unit.id)}
                              className="btn btn-primary btn-sm w-full"
                              disabled={generatingUnit === unit.id || !unit.total_students}
                            >
                              {generatingUnit === unit.id ? 'Generating...' : 'Generate Class'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-x-auto">
              <DragDropContext onDragEnd={handleDragEnd}>
                <div className="bg-white rounded-lg border border-surface-200 overflow-hidden">
                  <div className="min-w-[800px]">
                    <div className="flex">
                      <div className="w-20 flex-shrink-0 bg-surface-100">
                        <div className="h-14 border-b border-surface-200" />
                        {TIME_SLOTS.map(slot => (
                          <div 
                            key={slot} 
                            className="h-12 flex items-center justify-end pr-3 text-xs text-surface-500 font-medium border-b border-r border-surface-200"
                          >
                            {slot}
                          </div>
                        ))}
                      </div>

                      {DAYS.map(day => (
                        <Droppable key={day} droppableId={day}>
                          {(provided) => (
                            <div 
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className="flex-1 min-w-[150px] relative"
                            >
                              <div className="h-14 border-b border-surface-200 flex items-center justify-center" style={{ borderLeftColor: DAY_COLORS[day], borderLeftWidth: 3 }}>
                                <span className="font-semibold text-sm text-surface-900">{day}</span>
                              </div>

                              {TIME_SLOTS.map((slot, i) => (
                                <Droppable key={`${day}-${slot}`} droppableId={`${day}|${slot}`}>
                                  {(provided) => (
                                    <div 
                                      ref={provided.innerRef}
                                      {...provided.droppableProps}
                                      className={`h-12 border-b border-r border-surface-200 ${i % 2 === 0 ? 'bg-white' : 'bg-surface-50/50'}`}
                                    />
                                  )}
                                </Droppable>
                              ))}

                              {getEntriesForDay(day).map((entry, index) => {
                                const { top, height } = calculateCardStyle(entry);
                                const colors = entry.room_type === 'lab' 
                                  ? { bg: 'bg-amber-50', border: 'border-amber-300' }
                                  : { bg: 'bg-blue-50', border: 'border-blue-300' };
                                
                                return (
                                  <Draggable key={entry.id} draggableId={String(entry.id)} index={index}>
                                    {(provided, snapshot) => (
                                      <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        className={`absolute left-1 right-1 rounded-md p-2 cursor-grab hover:shadow-lg overflow-hidden ${colors.bg} ${colors.border} ${snapshot.isDragging ? 'shadow-xl scale-105 z-50 rotate-1' : ''}`}
                                        style={{
                                          height: `${height}px`,
                                          top: `${top + 56}px`,
                                          borderLeft: `4px solid ${DAY_COLORS[day]}`,
                                          ...provided.draggableProps.style
                                        }}
                                        onClick={() => handleEntryClick(entry)}
                                      >
                                        <div className="flex items-start justify-between mb-1">
                                          <span className="font-bold text-[11px] text-surface-900">
                                            {entry.unit_code || '---'}
                                          </span>
                                          {entry.is_recurring && (
                                            <span className="text-[8px]">🔄</span>
                                          )}
                                        </div>
                                        <div className="text-[10px] text-surface-700 font-medium truncate">
                                          {entry.unit_name || 'Unknown'}
                                        </div>
                                        <div className="text-[9px] text-surface-500 mt-1">
                                          {entry.group_name || 'Group'}
                                        </div>
                                        <div className="text-[9px] text-surface-400">
                                          {entry.start_time?.substring(0,5) || '00:00'} - {entry.end_time?.substring(0,5) || '00:00'}
                                        </div>
                                        <div className="text-[9px] text-surface-500 truncate mt-0.5">
                                          📍 {entry.room_number || 'TBA'} • 👤 {entry.tutor_name || 'No tutor'}
                                        </div>
                                      </div>
                                    )}
                                  </Draggable>
                                );
                              })}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      ))}
                    </div>
                  </div>
                </div>
              </DragDropContext>
            </div>
          </div>
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