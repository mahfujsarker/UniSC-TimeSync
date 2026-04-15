/**
 * Timetable Manager Page — Admin Kanban Grid
 * Grid-based timetable with classrooms as columns and time slots as rows.
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

const ROOM_TYPE_COLORS = {
  lab: { header: 'bg-amber-100', card: 'bg-amber-50 border-amber-300', badge: 'bg-amber-200 text-amber-800' },
  normal: { header: 'bg-blue-100', card: 'bg-blue-50 border-blue-300', badge: 'bg-blue-200 text-blue-800' }
};

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
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  const [unscheduledClasses, setUnscheduledClasses] = useState([]);
  const [scheduledEntries, setScheduledEntries] = useState([]);
  const [loading, setLoading] = useState(false);

  const [showModal, setShowModal] = useState(false);
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
      
      if (tr.data.length > 0) {
        setSelectedTrimester(tr.data[0].id);
      }
    }).catch(() => {});
  }, []);

  const loadTimetableData = useCallback(async () => {
    if (!selectedTrimester) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedDegree) params.append('degree_id', selectedDegree);
      if (selectedDay) params.append('day_of_week', selectedDay);

      const [unscheduledRes, entriesRes] = await Promise.all([
        api.get(`/classes/unscheduled?trimester_id=${selectedTrimester}${selectedDegree ? `&degree_id=${selectedDegree}` : ''}`),
        api.get(`/timetable?trimester_id=${selectedTrimester}&${params.toString()}`)
      ]);

      setUnscheduledClasses(unscheduledRes.data);
      setScheduledEntries(entriesRes.data);
    } catch {
      setToast({ message: 'Failed to load timetable data', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [selectedTrimester, selectedDegree, selectedDay]);

  useEffect(() => { loadTimetableData(); }, [loadTimetableData]);

  const handleDragEnd = async (result) => {
    const { source, destination, draggableId } = result;
    
    if (!destination) return;

    if (source.droppableId === 'class-pool' && destination.droppableId.startsWith('classroom-')) {
      const classId = draggableId.replace('pool-', '');
      const classData = unscheduledClasses.find(c => c.id === classId);
      if (!classData) return;

      const classroomId = destination.droppableId.replace('classroom-', '');
      const classroom = classrooms.find(c => c.id === classroomId);
      
      if (!classroom) return;
      
      if (classroom.type !== classData.required_room_type) {
        setToast({ 
          message: `Room type mismatch: ${classData.required_room_type === 'lab' ? 'Lab' : 'Normal'} room required`, 
          type: 'error' 
        });
        return;
      }

      const duration = classData.duration || 1;
      setScheduleForm({
        class_id: classId,
        unit_id: classData.unit_id,
        classroom_id: classroomId,
        tutor_id: '',
        day_of_week: selectedDay || 'Monday',
        start_time: '09:00',
        end_time: `${(9 + duration).toString().padStart(2, '0')}:00`,
        create_recurring: true
      });
      setEditingEntry(null);
      setShowModal(true);
    }
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
    setShowModal(true);
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

      setShowModal(false);
      loadTimetableData();
    } catch (e) {
      const conflicts = e.response?.data?.conflicts;
      if (conflicts?.length > 0) {
        setToast({ message: `Conflict: ${conflicts[0].message}`, type: 'error' });
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
      setShowModal(false);
      loadTimetableData();
    } catch {
      setToast({ message: 'Delete failed', type: 'error' });
    }
  };

  const getEntriesForClassroom = (classroomId) => {
    return scheduledEntries.filter(entry => {
      if (entry.classroom_id !== classroomId) return false;
      if (selectedDay && entry.day_of_week !== selectedDay) return false;
      return true;
    });
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

  const groupedClasses = unscheduledClasses.reduce((acc, cls) => {
    const key = cls.unit_code || 'Unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(cls);
    return acc;
  }, {});

  return (
    <div className="min-h-screen">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-surface-900" style={{ fontFamily: 'var(--font-heading)' }}>
          📅 Timetable Manager
        </h2>
        <button 
          onClick={() => loadTimetableData()} 
          className="btn btn-sm btn-secondary"
          disabled={loading}
        >
          {loading ? 'Loading...' : '↻ Refresh'}
        </button>
      </div>

      <div className="bg-white rounded-lg border border-surface-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="form-group">
            <label className="form-label">Degree</label>
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
            <label className="form-label">Trimester</label>
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
          <div className="form-group">
            <label className="form-label">Day</label>
            <select 
              className="form-select" 
              value={selectedDay} 
              onChange={e => setSelectedDay(e.target.value)}
            >
              <option value="">All Days</option>
              {DAYS.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Date</label>
            <input 
              type="date" 
              className="form-input" 
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {!selectedTrimester ? (
        <div className="bg-white rounded-lg border border-surface-200 p-12 text-center">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-surface-500">Select a trimester to manage the timetable</p>
        </div>
      ) : loading ? (
        <div className="bg-white rounded-lg border border-surface-200 p-12 text-center text-surface-400">
          Loading timetable...
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-4">
            <div className="w-72 flex-shrink-0">
              <Droppable droppableId="class-pool" direction="vertical">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`bg-white rounded-lg border border-surface-200 p-4 ${snapshot.isDraggingOver ? 'bg-blue-50' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-sm text-surface-900">Unscheduled Classes</h3>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-bold rounded">{unscheduledClasses.length}</span>
                    </div>
                    
                    {unscheduledClasses.length === 0 ? (
                      <div className="text-center py-6 text-surface-400 text-sm">
                        No unscheduled classes
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                        {Object.entries(groupedClasses).map(([unitCode, unitClasses]) => (
                          <div key={unitCode} className="mb-4">
                            <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-1.5 px-1">
                              {unitCode}
                            </div>
                            {unitClasses.map((cls, index) => {
                              const colors = cls.required_room_type === 'lab' 
                                ? { bg: 'bg-amber-50', border: 'border-amber-300', badge: 'bg-amber-200 text-amber-800' }
                                : { bg: 'bg-blue-50', border: 'border-blue-300', badge: 'bg-blue-200 text-blue-800' };
                              return (
                                <Draggable key={cls.id} draggableId={`pool-${cls.id}`} index={index}>
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      className={`border rounded-md p-3 mb-2 cursor-grab transition-all ${colors.bg} ${colors.border} ${
                                        snapshot.isDragging ? 'shadow-lg rotate-2 scale-[1.02]' : 'hover:shadow-md'
                                      }`}
                                      onClick={() => {
                                        const duration = cls.duration || 1;
                                        setScheduleForm({
                                          class_id: cls.id,
                                          unit_id: cls.unit_id,
                                          classroom_id: '',
                                          tutor_id: '',
                                          day_of_week: selectedDay || 'Monday',
                                          start_time: '09:00',
                                          end_time: `${(9 + duration).toString().padStart(2, '0')}:00`,
                                          create_recurring: true
                                        });
                                        setEditingEntry(null);
                                        setShowModal(true);
                                      }}
                                    >
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${colors.badge}`}>
                                          {cls.required_room_type?.toUpperCase() || 'NORMAL'}
                                        </span>
                                        <span className="font-semibold text-xs text-surface-900">
                                          {cls.group_name || 'Group'}
                                        </span>
                                      </div>
                                      <div className="text-xs text-surface-700 font-medium">
                                        {cls.unit_name || 'Unknown Unit'}
                                      </div>
                                      <div className="flex items-center gap-3 mt-2 text-[10px] text-surface-500">
                                        <span>⏱ {cls.duration || 1}h</span>
                                        <span>👥 {cls.max_capacity || 0}</span>
                                      </div>
                                    </div>
                                  )}
                                </Draggable>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>

            <div className="flex-1 overflow-x-auto">
              <div className="bg-white rounded-lg border border-surface-200 overflow-hidden">
                <div className="min-w-[900px]">
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

                    {classrooms.map(classroom => {
                      const colors = ROOM_TYPE_COLORS[classroom.type] || ROOM_TYPE_COLORS.normal;
                      const classroomEntries = getEntriesForClassroom(classroom.id);
                      
                      return (
                        <Droppable key={classroom.id} droppableId={`classroom-${classroom.id}`}>
                          {(provided, snapshot) => (
                            <div 
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className={`flex-1 min-w-[180px] relative ${snapshot.isDraggingOver ? 'bg-green-50' : ''}`}
                            >
                              <div className={`h-14 border-b border-surface-200 flex items-center justify-center ${colors.header}`}>
                                <div className="text-center">
                                  <div className="font-bold text-sm text-surface-900">{classroom.room_number || 'Room'}</div>
                                  <div className="text-[10px] text-surface-500">{classroom.location || 'N/A'}</div>
                                </div>
                              </div>

                              {TIME_SLOTS.map((slot, i) => (
                                <div 
                                  key={slot} 
                                  className={`h-12 border-b border-r border-surface-200 ${i % 2 === 0 ? 'bg-white' : 'bg-surface-50/50'}`}
                                />
                              ))}

                              {classroomEntries.map((entry) => {
                                const { top, height } = calculateCardStyle(entry);
                                const dayColor = DAY_COLORS[entry.day_of_week] || '#6366f1';
                                const colors = ROOM_TYPE_COLORS[entry.room_type] || ROOM_TYPE_COLORS.normal;
                                
                                return (
                                  <div
                                    key={entry.id}
                                    className={`absolute left-1 right-1 rounded-md p-2 cursor-pointer hover:shadow-lg overflow-hidden ${colors.card}`}
                                    style={{
                                      height: `${height}px`,
                                      top: `${top + 56}px`,
                                      borderLeft: `4px solid ${dayColor}`,
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
                                      {entry.group_name || 'Group'} • {entry.day_of_week?.substring(0, 3) || 'Mon'}
                                    </div>
                                    <div className="text-[9px] text-surface-400">
                                      {entry.start_time?.substring(0,5) || '00:00'} - {entry.end_time?.substring(0,5) || '00:00'}
                                    </div>
                                    <div className="text-[9px] text-surface-500 truncate mt-0.5">
                                      {entry.tutor_name || 'No tutor'}
                                    </div>
                                  </div>
                                );
                              })}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DragDropContext>
      )}

      <Modal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)} 
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
            <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
