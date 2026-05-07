/**
 * Timetable Manager Page — Room-based Weekly University Scheduler
 * Kanban board layout with rooms as rows, days as columns, time slots as sub-rows.
 * Enrolled student numbers entered per unit before generating classes.
 */
import { Fragment, useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
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

const BOARD_END_MINUTES = 22 * 60;
const SLOT_HEIGHT = 48;

const DAY_COLORS = {
  Monday: '#6366f1',
  Tuesday: '#8b5cf6',
  Wednesday: '#06b6d4',
  Thursday: '#f59e0b',
  Friday: '#10b981',
};

function timeToMinutes(time) {
  const [hour, minute] = time.substring(0, 5).split(':').map(Number);
  return hour * 60 + minute;
}

function minutesToTime(minutes) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`;
}

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
  const [enrolledStudents, setEnrolledStudents] = useState({});

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
      setEnrolledStudents(prev => {
        const next = { ...prev };
        res.data.forEach(unit => {
          if (next[unit.id] === undefined && unit.total_students !== undefined) {
            next[unit.id] = Number(unit.total_students) || 0;
          }
        });
        return next;
      });
    } catch {
      setToast({ message: 'Failed to load units', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [selectedTrimester, selectedDegree]);

  const loadScheduledEntries = useCallback(async () => {
    if (!selectedTrimester) {
      setScheduledEntries([]);
      return;
    }

    try {
      const params = new URLSearchParams({ trimester_id: selectedTrimester });
      const res = await api.get(`/timetable?${params.toString()}`);
      const uniqueEntries = Array.from(
        new Map(res.data.map(entry => [entry.id, entry])).values()
      );
      setScheduledEntries(uniqueEntries);
    } catch {
      console.error('Failed to load scheduled entries');
    }
  }, [selectedTrimester]);

  useEffect(() => { loadUnits(); }, [loadUnits]);
  useEffect(() => { loadScheduledEntries(); }, [loadScheduledEntries]);

  const handleEnrolledStudentsChange = async (unitId, value) => {
    const numValue = parseInt(value) || 0;
    setEnrolledStudents(prev => ({ ...prev, [unitId]: numValue }));

    try {
      await api.put(`/units/${unitId}/enrolled-students`, { total_students: numValue });
    } catch {
      setToast({ message: 'Failed to save enrolled students', type: 'error' });
    }
  };

  const getEnrolledStudents = (unitId) => {
    return enrolledStudents[unitId] || 0;
  };

  const handleGenerateClass = async (unitId) => {
    if (!selectedTrimester) {
      setToast({ message: 'Please select a trimester first', type: 'error' });
      return;
    }

    const enrolled = getEnrolledStudents(unitId);
    if (!enrolled || enrolled === 0) {
      setToast({ message: 'Please enter enrolled student number first', type: 'error' });
      return;
    }

    const unit = units.find(u => u.id === unitId);
    if (!unit) return;

    setGeneratingUnit(unitId);
    try {
      const numClasses = Math.ceil(enrolled / (unit?.classroom_type === 'lab' ? 25 : 30));

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
    const requiredCapacity = cls.max_capacity || (unit?.classroom_type === 'lab' ? 25 : 30);
    const suitableRooms = classrooms.filter(r =>
      r.type === (unit?.classroom_type || 'normal') &&
      r.max_capacity >= requiredCapacity &&
      r.is_available
    );

    if (suitableRooms.length === 0) {
      setToast({ message: `No room with enough capacity for ${requiredCapacity} students`, type: 'warning' });
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
            trimester_id: selectedTrimester,
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
        } catch {
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
        const enrolled = getEnrolledStudents(unit.id);
        if (!enrolled || enrolled === 0) continue;

        const numClasses = Math.ceil(enrolled / (unit.classroom_type === 'lab' ? 25 : 30));

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

  const handleMoveClass = async (entryId, newDay, newStartTime, newRoomId = null) => {
    const entry = scheduledEntriesById.get(entryId);
    if (!entry) return;

    const originalDurationMinutes = timeToMinutes(entry.end_time) - timeToMinutes(entry.start_time);
    const newStartMinutes = timeToMinutes(newStartTime);
    const newEndMinutes = newStartMinutes + originalDurationMinutes;

    if (newEndMinutes > BOARD_END_MINUTES) {
      setToast({ message: 'Class cannot end after 22:00', type: 'error' });
      return;
    }

    const formattedStartTime = minutesToTime(newStartMinutes);
    const newEndTime = minutesToTime(newEndMinutes);

    const updateData = {
      day_of_week: newDay,
      start_time: formattedStartTime,
      end_time: newEndTime
    };

    if (newRoomId) {
      updateData.classroom_id = newRoomId;
    }

    try {
      await api.put(`/timetable/${entryId}`, updateData);

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

  const handleDragEnd = (result) => {
    const { draggableId, destination } = result;
    if (!destination) return;

    const [roomId, timeSlot, day] = destination.droppableId.split('|');
    if (!roomId || !timeSlot || !day || !DAYS.includes(day)) return;

    handleMoveClass(draggableId, day, timeSlot, roomId);
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
    const startMinutes = timeToMinutes(entry.start_time);
    const endMinutes = timeToMinutes(entry.end_time);
    const durationSlots = (endMinutes - startMinutes) / 30;
    return { height: durationSlots * SLOT_HEIGHT - 4 };
  };

  const scheduledEntriesById = useMemo(() => {
    return new Map(scheduledEntries.map(entry => [String(entry.id), entry]));
  }, [scheduledEntries]);

  const entriesByCell = useMemo(() => {
    const cells = new Map();
    scheduledEntries.forEach(entry => {
      const key = `${entry.classroom_id}|${entry.start_time?.substring(0, 5)}|${entry.day_of_week}`;
      const existing = cells.get(key) || [];
      existing.push(entry);
      cells.set(key, existing);
    });
    return cells;
  }, [scheduledEntries]);

  const scheduledCountsByUnit = useMemo(() => {
    return scheduledEntries.reduce((counts, entry) => {
      counts.set(entry.unit_id, (counts.get(entry.unit_id) || 0) + 1);
      return counts;
    }, new Map());
  }, [scheduledEntries]);

  const getScheduledCountForUnit = (unitId) => {
    return scheduledCountsByUnit.get(unitId) || 0;
  };

  const roomTypeLabel = (type) => type === 'lab' ? 'Lab' : 'Normal';
  const gridColumnCount = Math.max(classrooms.length * DAYS.length, 1);
  const boardGridTemplateColumns = `6rem repeat(${gridColumnCount}, minmax(5.75rem, 1fr))`;
  const boardMinWidth = `${96 + gridColumnCount * 92}px`;

  return (
    <div className="min-h-screen">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-surface-900" style={{ fontFamily: 'var(--font-heading)' }}>
          📅 Timetable Scheduler
        </h2>
        <div className="flex gap-2">
          {selectedTrimester ? (
            <Link to={`/admin/timetable/routine/${selectedTrimester}`} className="btn btn-sm btn-primary">
              View Routine
            </Link>
          ) : (
            <button className="btn btn-sm btn-primary" disabled>
              View Routine
            </button>
          )}
          <button
            onClick={() => { loadUnits(); loadScheduledEntries(); }}
            className="btn btn-sm btn-secondary"
            disabled={loading}
          >
            ↻ Refresh
          </button>
        </div>
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

      <>
          <div className="flex gap-4 mb-6">
            <div className="w-80 flex-shrink-0">
              <div className="bg-white rounded-lg border border-surface-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm text-surface-900">Units</h3>
                  <button
                    onClick={handleGenerateAll}
                    className="btn btn-sm btn-primary"
                    disabled={!selectedTrimester || generatingUnit === 'all' || loading || units.length === 0}
                  >
                    {generatingUnit === 'all' ? 'Generating...' : 'Generate All'}
                  </button>
                </div>

                {!selectedTrimester ? (
                  <div className="text-center py-6 text-surface-500 text-sm">Select a trimester for generation</div>
                ) : loading ? (
                  <div className="text-center py-6 text-surface-400 text-sm">Loading units...</div>
                ) : units.length === 0 ? (
                  <div className="text-center py-6 text-surface-500 text-sm">No units for selected filters</div>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                    {units.map(unit => {
                      const scheduledCount = getScheduledCountForUnit(unit.id);
                      const enrolled = getEnrolledStudents(unit.id);
                      const numClasses = Math.ceil(enrolled / (unit.classroom_type === 'lab' ? 25 : 30));
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

                          <div className="flex items-center gap-2 mb-2">
                            <label className="text-[10px] text-surface-500">Enrolled:</label>
                            <input
                              type="number"
                              min="0"
                              className="w-16 text-[10px] border border-surface-300 rounded px-1 py-0.5"
                              placeholder="0"
                              value={enrolled || ''}
                              onChange={e => handleEnrolledStudentsChange(unit.id, e.target.value)}
                            />
                            {enrolled > 0 && (
                              <span className="text-[10px] text-surface-500">
                                Est. classes: {numClasses}
                              </span>
                            )}
                          </div>

                          {hasClasses ? (
                            <div className="flex items-center gap-2 text-sm text-success">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                              </svg>
                              <span>✓ Generated ({scheduledCount} classes)</span>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleGenerateClass(unit.id)}
                              className="btn btn-primary btn-sm w-full"
                              disabled={!selectedTrimester || generatingUnit === unit.id || enrolled === 0}
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

            <div className="flex-1 min-w-0 overflow-x-auto">
              <DragDropContext onDragEnd={handleDragEnd}>
                <div className="bg-white rounded-lg border border-surface-200 overflow-auto max-h-[calc(100vh-260px)]">
                  {classrooms.length === 0 ? (
                    <div className="p-12 text-center text-surface-500">No available classrooms</div>
                  ) : (
                    <div style={{ minWidth: boardMinWidth }}>
                      <div
                        className="grid sticky top-0 z-20 bg-white"
                        style={{ gridTemplateColumns: boardGridTemplateColumns }}
                      >
                        <div className="row-span-2 h-24 flex items-center justify-center bg-surface-50 border-b border-r border-surface-200 font-semibold text-surface-800">
                          Time
                        </div>

                        {classrooms.map(room => (
                          <div
                            key={room.id}
                            className={`h-12 flex items-center justify-center border-b border-r border-surface-200 font-bold text-surface-900 ${room.type === 'lab' ? 'bg-amber-50' : 'bg-blue-50'}`}
                            style={{ gridColumn: `span ${DAYS.length} / span ${DAYS.length}` }}
                          >
                            {room.room_number}
                          </div>
                        ))}

                        {classrooms.map(room => (
                          DAYS.map(day => (
                            <div
                              key={`${room.id}-${day}-header`}
                              className="h-12 flex items-center justify-center border-b border-r border-surface-200 bg-surface-50 text-xs font-semibold text-surface-700"
                              style={{ borderLeft: `3px solid ${DAY_COLORS[day]}` }}
                            >
                              {day.substring(0, 3)}
                            </div>
                          ))
                        ))}
                      </div>

                      <div
                        className="grid"
                        style={{ gridTemplateColumns: boardGridTemplateColumns }}
                      >
                        {TIME_SLOTS.map((slot, slotIndex) => (
                          <Fragment key={slot}>
                            <div className="h-12 relative flex items-start justify-end pr-3 pt-1 text-xs text-surface-500 font-medium border-b border-r border-surface-200 bg-surface-50">
                              <span>{slot}</span>
                              {slotIndex === TIME_SLOTS.length - 1 && (
                                <span className="absolute -bottom-2 right-3 bg-surface-50 pl-1">22:00</span>
                              )}
                            </div>

                            {classrooms.map(room => {
                              const colors = room.type === 'lab'
                                ? { bg: 'bg-amber-50', border: 'border-amber-300' }
                                : { bg: 'bg-blue-50', border: 'border-blue-300' };

                              return DAYS.map(day => {
                                const droppableId = `${room.id}|${slot}|${day}`;
                                const cellEntries = entriesByCell.get(droppableId) || [];

                                return (
                                  <Droppable key={droppableId} droppableId={droppableId}>
                                    {(provided, snapshot) => (
                                      <div
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        className={`h-12 border-b border-r border-surface-200 relative transition-colors duration-75 ${slotIndex % 2 === 0 ? 'bg-white' : 'bg-surface-50/50'} ${snapshot.isDraggingOver ? 'bg-emerald-50 ring-2 ring-emerald-400 ring-inset' : ''}`}
                                      >
                                        {cellEntries.map((entry, entryIndex) => {
                                          const { height } = calculateCardStyle(entry);
                                          const dayColor = DAY_COLORS[day] || '#6366f1';

                                          return (
                                            <Draggable key={entry.id} draggableId={String(entry.id)} index={entryIndex}>
                                              {(provided, snapshot) => (
                                                <div
                                                  ref={provided.innerRef}
                                                  {...provided.draggableProps}
                                                  {...provided.dragHandleProps}
                                                  className={`absolute left-1 right-1 z-10 rounded-md p-1 cursor-grab overflow-hidden text-[10px] border ${colors.bg} ${colors.border} ${snapshot.isDragging ? 'shadow-xl z-50 cursor-grabbing ring-2 ring-brand-blue/30' : 'hover:shadow-md'}`}
                                                  style={{
                                                    height: `${height}px`,
                                                    top: '2px',
                                                    borderLeft: `3px solid ${dayColor}`,
                                                    willChange: snapshot.isDragging ? 'transform' : undefined,
                                                    ...provided.draggableProps.style
                                                  }}
                                                  onClick={() => handleEntryClick(entry)}
                                                >
                                                  <div className="font-bold text-[10px] leading-tight truncate text-surface-900">
                                                    {entry.unit_code}
                                                  </div>
                                                  <div className="text-[9px] leading-tight truncate text-surface-700">
                                                    {entry.group_name}
                                                  </div>
                                                  <div className="text-[9px] leading-tight truncate text-surface-600">
                                                    {entry.start_time?.substring(0, 5)}-{entry.end_time?.substring(0, 5)}
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
                                );
                              });
                            })}
                          </Fragment>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </DragDropContext>
            </div>
          </div>
        </>

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
