/**
 * Timetable Manager Page — Room-based Weekly University Scheduler
 * Kanban board layout with rooms as rows, days as columns, time slots as sub-rows.
 * Enrolled student numbers entered per course before generating classes.
 */
import { Fragment, memo, useState, useEffect, useCallback, useMemo, useRef } from 'react';
/* eslint-disable react-hooks/refs */
import { Link } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { createPortal } from 'react-dom';
import api from '../../api/axios';
import Modal from '../../components/Modal';
import Toast from '../../components/Toast';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const TIME_SLOTS = [];
for (let hour = 8; hour <= 22; hour++) {
  TIME_SLOTS.push(`${hour.toString().padStart(2, '0')}:00`);
  if (hour < 22) {
    TIME_SLOTS.push(`${hour.toString().padStart(2, '0')}:30`);
  }
}

const BOARD_END_MINUTES = 22 * 60;
const SLOT_HEIGHT = 48;
const ZOOM_MIN = 0.35;
const ZOOM_MAX = 1.5;
const ZOOM_STEP = 0.1;
const ZOOM_STORAGE_KEY = 'ttms:timetable-board-zoom';
const BOARD_HEADER_ROWS = 2;

const DAY_COLORS = {
  Monday: '#6366f1',
  Tuesday: '#8b5cf6',
  Wednesday: '#06b6d4',
  Thursday: '#f59e0b',
  Friday: '#10b981',
};
const DAY_SHORT_LABELS = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
};

const MINI_MAP_COLORS = ['#0052c4', '#198754', '#f59e0b', '#8b5cf6', '#dc3545', '#06b6d4', '#111111'];

function timeToMinutes(time) {
  if (!time) return NaN;
  const [hour, minute] = String(time).substring(0, 5).split(':').map(Number);
  return hour * 60 + minute;
}

function minutesToTime(minutes) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`;
}

function ClassLocationMiniMap({ classrooms, courseEntries, onFocusEntry }) {
  const gridColumnCount = Math.max(classrooms.length * DAYS.length, 1);
  const gridTemplateColumns = `2rem repeat(${gridColumnCount}, 0.375rem)`;
  const minWidth = `${Math.max(150, 32 + gridColumnCount * 8)}px`;

  const entryColors = useMemo(() => {
    return courseEntries.reduce((colors, entry, index) => {
      colors.set(String(entry.id), MINI_MAP_COLORS[index % MINI_MAP_COLORS.length]);
      return colors;
    }, new Map());
  }, [courseEntries]);

  const entriesByCoveredCell = useMemo(() => {
    const cells = new Map();

    courseEntries.forEach(entry => {
      const startMinutes = timeToMinutes(entry.start_time);
      const endMinutes = timeToMinutes(entry.end_time);
      if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) return;

      const coveredSlots = TIME_SLOTS.filter(slot => {
        const slotMinutes = timeToMinutes(slot);
        return slotMinutes >= startMinutes && slotMinutes < endMinutes;
      });

      TIME_SLOTS.forEach(slot => {
        const slotMinutes = timeToMinutes(slot);
        if (slotMinutes >= startMinutes && slotMinutes < endMinutes) {
          const slotIndex = coveredSlots.indexOf(slot);
          cells.set(`${entry.classroom_id}|${slot}|${entry.day_of_week}`, {
            entry,
            color: entryColors.get(String(entry.id)) || MINI_MAP_COLORS[0],
            isStart: slotIndex === 0,
            isEnd: slotIndex === coveredSlots.length - 1,
            isSingle: coveredSlots.length === 1
          });
        }
      });
    });

    return cells;
  }, [entryColors, courseEntries]);

  const getTooltip = (room, day, slot, entry) => {
    if (!entry) return `${room.room_number} | ${day} | ${slot}`;

    return [
      `Class Group: ${String(entry.group_name || 'N/A').replace(/^Group\s+/i, '')}`,
      `Room: ${room.room_number}`,
      `Day: ${day}`,
      `Time: ${entry.start_time?.substring(0, 5)}-${entry.end_time?.substring(0, 5)}`,
      `Tutor: ${entry.tutor_name || 'TBA'}`
    ].join('\n');
  };

  if (classrooms.length === 0) {
    return (
      <div className="mt-2 rounded-lg border border-white/70 bg-white/55 p-2 text-[10px] text-surface-500">
        No rooms available for map.
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-xl border border-white/70 bg-white/65 p-2 shadow-sm backdrop-blur">
      <div className="mb-2 flex items-center justify-between gap-2 text-[10px] text-surface-500">
        <span>{classrooms.length} rooms x {DAYS.length} days x {TIME_SLOTS.length} slots</span>
        <span className="font-semibold text-brand-blue">{courseEntries.length} class{courseEntries.length === 1 ? '' : 'es'}</span>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="grid gap-[2px]" style={{ gridTemplateColumns, minWidth }}>
          <div />
          {classrooms.flatMap(room => (
            DAYS.map(day => (
              <span
                key={`${room.id}-${day}-map-header`}
                className="h-1.5 w-1.5 rounded-sm"
                title={`${room.room_number} | ${day}`}
                style={{ backgroundColor: DAY_COLORS[day] }}
              />
            ))
          ))}

          {TIME_SLOTS.map(slot => (
            <Fragment key={`map-row-${slot}`}>
              <div className="h-1.5 pr-1 text-right text-[8px] leading-[0.375rem] text-surface-400">
                {slot.endsWith(':00') ? slot.substring(0, 2) : ''}
              </div>

              {classrooms.flatMap(room => (
                DAYS.map(day => {
                  const key = `${room.id}|${slot}|${day}`;
                  const cell = entriesByCoveredCell.get(key);
                  const entry = cell?.entry;
                  const title = getTooltip(room, day, slot, entry);

                  if (entry) {
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`minimap-dot minimap-dot-active ${cell.isSingle ? 'is-single' : ''} ${cell.isStart ? 'is-start' : ''} ${cell.isEnd ? 'is-end' : ''}`}
                        style={{ backgroundColor: cell.color, borderColor: cell.color }}
                        title={title}
                        aria-label={title.replace(/\n/g, ', ')}
                        onClick={() => onFocusEntry(entry)}
                      />
                    );
                  }

                  return (
                    <span
                      key={key}
                      className="minimap-dot bg-surface-300/60"
                      title={title}
                    />
                  );
                })
              ))}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

const TimetableEntryCard = memo(function TimetableEntryCard({
  entry,
  provided,
  snapshot,
  height,
  zoomLevel,
  dayColor,
  focused,
  hasWarning,
  borderClass,
  onEntryClick
}) {
  const compact = zoomLevel < 0.72;
  const roomy = zoomLevel >= 1.05;
  const tiny = height < 24;
  const conflictTitle = hasWarning
    ? 'Current tutor is no longer available at this time. Assign a new tutor or move the class.'
    : undefined;
  const tooltip = [
    `${entry.unit_code || 'N/A'} ${entry.unit_name || ''}`.trim(),
    `Group: ${entry.group_name || 'N/A'}`,
    `Room: ${entry.room_number || 'TBA'}`,
    `Tutor: ${entry.tutor_name || 'TBA'}`,
    `Time: ${entry.start_time?.substring(0, 5) || ''}-${entry.end_time?.substring(0, 5) || ''}`
  ].filter(Boolean).join('\n');

  const card = (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      id={`timetable-entry-${entry.id}`}
      className={`${snapshot.isDragging ? 'z-50 is-dragging' : 'absolute left-1 right-1 z-30'} timetable-entry-card ${compact ? 'is-compact' : ''} ${roomy ? 'is-roomy' : ''} ${hasWarning ? 'has-warning border-amber-400 ring-2 ring-amber-400/35' : borderClass} ${focused ? 'timetable-focus-glow' : ''}`}
      title={conflictTitle || tooltip}
      style={{
        height: `${height}px`,
        top: snapshot.isDragging ? undefined : '2px',
        borderLeft: `3px solid ${hasWarning ? '#f59e0b' : dayColor}`,
        willChange: snapshot.isDragging ? 'transform' : undefined,
        ...provided.draggableProps.style
      }}
      onClick={() => onEntryClick(entry)}
    >
      <div className="font-bold text-[10px] leading-tight truncate text-surface-900">
        {entry.unit_code}
      </div>
      {!compact && !tiny && (
        <div className="text-[9px] leading-tight truncate text-surface-700">
          {entry.group_name}
        </div>
      )}
      {roomy && !tiny && (
        <div className="text-[9px] leading-tight truncate text-surface-700">
          {entry.tutor_name || 'Tutor TBA'}
        </div>
      )}
      {!tiny && (
        <div className="text-[9px] leading-tight truncate text-surface-600">
          {entry.start_time?.substring(0, 5)}-{entry.end_time?.substring(0, 5)}
        </div>
      )}
      {hasWarning && (
        <div className="mt-0.5 flex items-center gap-1 rounded bg-amber-100 px-1 py-0.5 text-[8px] font-bold leading-tight text-amber-800">
          <span aria-hidden="true">!</span>
          <span className="truncate">Assign new tutor</span>
        </div>
      )}
    </div>
  );

  return snapshot.isDragging && typeof document !== 'undefined'
    ? createPortal(card, document.body)
    : card;
});

export default function TimetableManager() {
  const [degrees, setDegrees] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [trimesters, setTrimesters] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [tutors, setTutors] = useState([]);

  const [selectedDegree, setSelectedDegree] = useState('');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('');
  const [selectedTrimester, setSelectedTrimester] = useState('');

  const [courses, setCourses] = useState([]);
  const [scheduledEntries, setScheduledEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generatingCourse, setGeneratingCourse] = useState(null);
  const [enrolledStudents, setEnrolledStudents] = useState({});
  const [expandedMiniMaps, setExpandedMiniMaps] = useState({});
  const [coursePanelOpen, setCoursePanelOpen] = useState(true);
  const [isBoardDragging, setIsBoardDragging] = useState(false);
  const [boardZoom, setBoardZoom] = useState(() => {
    const saved = typeof window === 'undefined' ? NaN : Number(window.localStorage?.getItem(ZOOM_STORAGE_KEY));
    return Number.isFinite(saved) ? Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, saved)) : 1;
  });
  const [focusedEntryId, setFocusedEntryId] = useState(null);
  const focusTimeoutRef = useRef(null);
  const selectedTrimesterRef = useRef('');
  const boardShellRef = useRef(null);
  const gridColumnCount = Math.max(classrooms.length * DAYS.length, 1);

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
      api.get('/trimesters/academic-years'),
      api.get('/trimesters?status=published'),
      api.get('/classrooms'),
      api.get('/tutors'),
    ]).then(([d, ay, tr, c, t]) => {
      setDegrees(d.data);
      setAcademicYears(ay.data);
      setTrimesters(tr.data);
      setClassrooms(c.data.filter(cl => cl.is_available));
      setTutors(t.data);
      
      if (d.data.length > 0) {
        setSelectedDegree(d.data[0].id);
      }
      const publishedPeriods = tr.data;
      const initialYearId = publishedPeriods[0]?.academic_year_id || ay.data.find(year =>
        publishedPeriods.some(period => String(period.academic_year_id) === String(year.id))
      )?.id || '';
      const initialPeriod = publishedPeriods.find(period => String(period.academic_year_id) === String(initialYearId)) || publishedPeriods[0];
      if (initialYearId) {
        setSelectedAcademicYear(initialYearId);
      }
      if (initialPeriod) {
        setSelectedTrimester(initialPeriod.id);
      }
    }).catch(() => {});
  }, []);

  const teachingPeriodsForYear = useMemo(() => {
    return trimesters.filter(period =>
      (!selectedAcademicYear || String(period.academic_year_id) === String(selectedAcademicYear))
    );
  }, [trimesters, selectedAcademicYear]);

  useEffect(() => {
    if (!selectedAcademicYear) return;
    if (!teachingPeriodsForYear.some(period => String(period.id) === String(selectedTrimester))) {
      setSelectedTrimester(teachingPeriodsForYear[0]?.id || '');
    }
  }, [selectedAcademicYear, selectedTrimester, teachingPeriodsForYear]);

  const loadCourses = useCallback(async () => {
    if (!selectedTrimester) {
      setCourses([]);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedDegree) params.append('degree_id', selectedDegree);
      params.append('trimester_id', selectedTrimester);
      
      const res = await api.get(`/courses/by-degree?${params.toString()}`);
      setCourses(res.data);
      setEnrolledStudents(prev => {
        const next = { ...prev };
        res.data.forEach(course => {
          if (next[course.id] === undefined && course.total_students !== undefined) {
            next[course.id] = Number(course.total_students) || 0;
          }
        });
        return next;
      });
    } catch {
      setToast({ message: 'Failed to load courses', type: 'error' });
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
      const trimesterId = selectedTrimester;
      const params = new URLSearchParams({ trimester_id: trimesterId });
      const res = await api.get(`/timetable?${params.toString()}`);
      if (String(selectedTrimesterRef.current) !== String(trimesterId)) return;
      const uniqueEntries = Array.from(
        new Map(res.data.map(entry => [entry.id, entry])).values()
      );
      setScheduledEntries(uniqueEntries);
    } catch {
      console.error('Failed to load scheduled entries');
    }
  }, [selectedTrimester]);

  useEffect(() => {
    selectedTrimesterRef.current = selectedTrimester;
    setScheduledEntries([]);
    setExpandedMiniMaps({});
    setFocusedEntryId(null);
  }, [selectedTrimester]);

  useEffect(() => { loadCourses(); }, [loadCourses]);
  useEffect(() => { loadScheduledEntries(); }, [loadScheduledEntries]);

  useEffect(() => {
    return () => {
      if (focusTimeoutRef.current) {
        window.clearTimeout(focusTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    window.localStorage?.setItem(ZOOM_STORAGE_KEY, String(boardZoom));
  }, [boardZoom]);

  const calculateFitZoom = useCallback(() => {
    const shell = boardShellRef.current;
    if (!shell || gridColumnCount <= 0) return ZOOM_MIN;

    const rect = shell.getBoundingClientRect();
    const availableWidth = Math.max(320, rect.width - 18);
    const availableHeight = Math.max(320, window.innerHeight - rect.top - 28);
    const baseWidth = 96 + gridColumnCount * 92;
    const baseHeight = SLOT_HEIGHT * (TIME_SLOTS.length + BOARD_HEADER_ROWS) + 8;
    const fit = Math.min(availableWidth / baseWidth, availableHeight / baseHeight, ZOOM_MAX);
    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number(fit.toFixed(2))));
  }, [gridColumnCount]);

  const changeBoardZoom = useCallback((direction) => {
    setBoardZoom(current => {
      const next = direction === 'reset'
        ? 1
        : direction === 'fit'
          ? calculateFitZoom()
          : current + (direction === 'in' ? ZOOM_STEP : -ZOOM_STEP);
      return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number(next.toFixed(2))));
    });
  }, [calculateFitZoom]);

  const handleEnrolledStudentsChange = async (courseId, value) => {
    const numValue = parseInt(value) || 0;
    setEnrolledStudents(prev => ({ ...prev, [courseId]: numValue }));

    try {
      await api.put(`/courses/${courseId}/enrolled-students`, { total_students: numValue });
    } catch {
      setToast({ message: 'Failed to save enrolled students', type: 'error' });
    }
  };

  const getEnrolledStudents = (courseId) => {
    return enrolledStudents[courseId] || 0;
  };

  const handleGenerateClass = async (courseId) => {
    if (!selectedTrimester) {
      setToast({ message: 'Please select a teaching period first', type: 'error' });
      return;
    }

    const enrolled = getEnrolledStudents(courseId);
    if (!enrolled || enrolled === 0) {
      setToast({ message: 'Please enter enrolled student number first', type: 'error' });
      return;
    }

    const course = courses.find(item => item.id === courseId);
    if (!course) return;

    setGeneratingCourse(courseId);
    try {
      const numClasses = Math.ceil(enrolled / (course?.classroom_type === 'lab' ? 25 : 30));

      const createdClasses = [];
      let scheduled = 0;
      for (let i = 0; i < numClasses; i++) {
        const letter = String.fromCharCode(65 + i);
        const groupName = `Group ${letter}`;

        const classRes = await api.post('/classes', {
          unit_id: courseId,
          trimester_id: selectedTrimester,
          group_name: groupName,
          required_room_type: course?.classroom_type || 'normal',
          duration: course?.class_duration || 1,
          max_capacity: course?.classroom_type === 'lab' ? 25 : 30
        });

        const newClass = classRes.data;
        createdClasses.push(newClass);

        const assigned = await autoScheduleClass(newClass, course, { showFailureToast: false });
        if (assigned) {
          scheduled++;
          await loadScheduledEntries();
        }
      }

      setToast({
        message: `${createdClasses.length} class(es) generated, ${scheduled} scheduled`,
        type: scheduled === createdClasses.length ? 'success' : 'warning'
      });
      loadCourses();
      loadScheduledEntries();
    } catch (err) {
      setToast({ message: err.response?.data?.error || 'Failed to generate classes', type: 'error' });
    } finally {
      setGeneratingCourse(null);
    }
  };

  const autoScheduleClass = async (cls, course, { showFailureToast = true } = {}) => {
    const requiredCapacity = cls.max_capacity || (course?.classroom_type === 'lab' ? 25 : 30);
    const suitableRooms = classrooms.filter(r =>
      r.type === (course?.classroom_type || 'normal') &&
      r.max_capacity >= requiredCapacity &&
      r.is_available
    );

    if (suitableRooms.length === 0) {
      if (showFailureToast) {
        setToast({ message: `No room with enough capacity for ${requiredCapacity} students`, type: 'warning' });
      }
      return false;
    }

    if (tutors.length === 0) {
      if (showFailureToast) {
        setToast({ message: 'No tutor available for auto-scheduling', type: 'warning' });
      }
      return false;
    }

    let lastError = '';
    for (const room of suitableRooms) {
      for (const tutor of tutors) {
        for (const day of DAYS) {
          for (let i = 0; i < TIME_SLOTS.length - 1; i++) {
            const startTime = TIME_SLOTS[i];
            const duration = cls.duration || course?.class_duration || 1;
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
            } catch (err) {
              lastError = err.response?.data?.errors?.[0]
                || err.response?.data?.error
                || lastError;
              continue;
            }
          }
        }
      }
    }

    if (showFailureToast) {
      setToast({ message: lastError || 'Could not auto-schedule. Please manually assign.', type: 'warning' });
    }
    return false;
  };

  const handleGenerateAll = async () => {
    if (!selectedTrimester) {
      setToast({ message: 'Please select a teaching period first', type: 'error' });
      return;
    }

    setGeneratingCourse('all');
    try {
      let generated = 0;
      let scheduled = 0;

      for (const course of courses) {
        const enrolled = getEnrolledStudents(course.id);
        if (!enrolled || enrolled === 0) continue;

        const numClasses = Math.ceil(enrolled / (course.classroom_type === 'lab' ? 25 : 30));

        for (let i = 0; i < numClasses; i++) {
          const letter = String.fromCharCode(65 + i);
          const groupName = `Group ${letter}`;

          try {
            const classRes = await api.post('/classes', {
              unit_id: course.id,
              trimester_id: selectedTrimester,
              group_name: groupName,
              required_room_type: course.classroom_type,
              duration: course.class_duration || 1,
              max_capacity: course.classroom_type === 'lab' ? 25 : 30
            });

            const assigned = await autoScheduleClass(classRes.data, course, { showFailureToast: false });
            generated++;
            if (assigned) scheduled++;
          } catch {
            continue;
          }
        }
      }

      setToast({
        message: `${generated} class(es) generated, ${scheduled} scheduled`,
        type: scheduled === generated ? 'success' : 'warning'
      });
      loadCourses();
      loadScheduledEntries();
    } catch (err) {
      setToast({ message: err.response?.data?.error || 'Failed to generate classes', type: 'error' });
    } finally {
      setGeneratingCourse(null);
    }
  };

  const handleMoveClass = useCallback(async (entryId, newDay, newStartTime, newRoomId = null) => {
    const entry = scheduledEntries.find(item => String(item.id) === String(entryId));
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

      const newRoom = newRoomId
        ? classrooms.find(room => String(room.id) === String(newRoomId))
        : null;

      setScheduledEntries(prev => prev.map(item => (
        String(item.id) === String(entryId)
          ? {
              ...item,
              day_of_week: newDay,
              start_time: formattedStartTime,
              end_time: newEndTime,
              classroom_id: newRoomId || item.classroom_id,
              room_number: newRoom?.room_number || item.room_number,
              room_location: newRoom?.location || item.room_location,
              room_type: newRoom?.type || item.room_type,
              max_capacity: newRoom?.max_capacity || item.max_capacity
            }
          : item
      )));

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
  }, [classrooms, loadScheduledEntries, scheduledEntries]);

  const handleDragStart = useCallback(() => {
    setIsBoardDragging(true);
  }, []);

  const handleDragEnd = useCallback((result) => {
    setIsBoardDragging(false);
    const { draggableId, destination } = result;
    if (!destination) return;

    const [roomId, timeSlot, day] = destination.droppableId.split('|');
    if (!roomId || !timeSlot || !day || !DAYS.includes(day)) return;

    handleMoveClass(draggableId, day, timeSlot, roomId);
  }, [handleMoveClass]);

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

  const toggleMiniMap = (courseId) => {
    setExpandedMiniMaps(prev => ({
      ...prev,
      [courseId]: !prev[courseId]
    }));
  };

  const focusEntryOnBoard = useCallback((entry) => {
    const entryId = String(entry.id);
    const element = document.getElementById(`timetable-entry-${entryId}`);

    setFocusedEntryId(entryId);

    if (focusTimeoutRef.current) {
      window.clearTimeout(focusTimeoutRef.current);
    }

    if (element) {
      requestAnimationFrame(() => {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'center'
        });
      });
    }

    focusTimeoutRef.current = window.setTimeout(() => {
      setFocusedEntryId(current => current === entryId ? null : current);
    }, 3200);
  }, []);

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
      loadCourses();
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

  const calculateCardStyle = useCallback((entry) => {
    const startMinutes = timeToMinutes(entry.start_time);
    const endMinutes = timeToMinutes(entry.end_time);
    const durationSlots = (endMinutes - startMinutes) / 30;
    return { height: Math.max(18, durationSlots * SLOT_HEIGHT * boardZoom - 4) };
  }, [boardZoom]);

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

  const scheduledCountsByCourse = useMemo(() => {
    return scheduledEntries.reduce((counts, entry) => {
      counts.set(entry.unit_id, (counts.get(entry.unit_id) || 0) + 1);
      return counts;
    }, new Map());
  }, [scheduledEntries]);

  const scheduledEntriesByCourse = useMemo(() => {
    return scheduledEntries.reduce((entries, entry) => {
      const key = String(entry.unit_id);
      const existing = entries.get(key) || [];
      existing.push(entry);
      entries.set(key, existing);
      return entries;
    }, new Map());
  }, [scheduledEntries]);

  const getScheduledCountForCourse = useCallback((courseId) => {
    return scheduledCountsByCourse.get(courseId) || 0;
  }, [scheduledCountsByCourse]);

  const getGeneratedCountForCourse = useCallback((course) => {
    return Number(course.classes_count ?? course.classes?.length ?? 0);
  }, []);

  const roomTypeLabel = (type) => type === 'lab' ? 'Lab' : 'Normal';
  const timeColumnWidth = Math.round(96 * boardZoom);
  const boardColumnWidth = Math.round(92 * boardZoom);
  const slotHeight = Math.max(18, Math.round(SLOT_HEIGHT * boardZoom));
  const boardGridTemplateColumns = `${timeColumnWidth}px repeat(${gridColumnCount}, minmax(${boardColumnWidth}px, 1fr))`;
  const boardMinWidth = `${timeColumnWidth + gridColumnCount * boardColumnWidth}px`;
  const boardZoomStyle = {
    '--slot-height': `${slotHeight}px`,
    '--board-zoom': boardZoom,
    '--board-card-font': `${Math.max(8, 10 * boardZoom)}px`
  };

  const handleScheduleGeneratedClasses = async (course) => {
    const existingClasses = Array.isArray(course.classes) ? course.classes : [];
    const scheduledClassIds = new Set(
      scheduledEntries
        .filter(entry => String(entry.unit_id) === String(course.id))
        .map(entry => String(entry.class_id))
    );
    const missingClasses = existingClasses
      .filter(cls => !scheduledClassIds.has(String(cls.id)))
      .map(cls => ({ ...cls, unit_id: course.id }));

    if (missingClasses.length === 0) {
      setToast({ message: 'All generated classes are already scheduled', type: 'success' });
      return;
    }

    setGeneratingCourse(`schedule-${course.id}`);
    try {
      let scheduled = 0;
      for (const cls of missingClasses) {
        const assigned = await autoScheduleClass(cls, course, { showFailureToast: false });
        if (assigned) scheduled++;
      }

      setToast({
        message: `${scheduled}/${missingClasses.length} generated class(es) scheduled`,
        type: scheduled === missingClasses.length ? 'success' : 'warning'
      });
      loadCourses();
      loadScheduledEntries();
    } catch (err) {
      setToast({ message: err.response?.data?.error || 'Failed to schedule generated classes', type: 'error' });
    } finally {
      setGeneratingCourse(null);
    }
  };
  const generatedCourses = useMemo(() => courses.filter(course => getScheduledCountForCourse(course.id) > 0).length, [courses, getScheduledCountForCourse]);

  return (
    <div className="min-h-screen">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div className="timetable-workspace">
        <div className="timetable-toolbar glass-card">
          <div className="min-w-[12rem]">
            <p className="page-kicker">Scheduling board</p>
            <h2 className="text-xl font-black text-brand-dark leading-tight">Timetable Scheduler</h2>
          </div>

          <div className="timetable-toolbar-controls">
            <label className="toolbar-field">
              <span>Academic Year</span>
              <select
                className="form-select"
                value={selectedAcademicYear}
                onChange={e => setSelectedAcademicYear(e.target.value)}
              >
                <option value="">All Years</option>
                {academicYears.map(year => (
                  <option key={year.id} value={year.id}>{year.year}</option>
                ))}
              </select>
            </label>
            <label className="toolbar-field min-w-[15rem]">
              <span>Degree</span>
              <select
                className="form-select"
                value={selectedDegree}
                onChange={e => setSelectedDegree(e.target.value)}
              >
                <option value="">All Degrees</option>
                {degrees.map(d => (
                  <option key={d.id} value={d.id}>{d.code} - {d.name}</option>
                ))}
              </select>
            </label>
            <label className="toolbar-field min-w-[14rem]">
              <span>Teaching Period</span>
              <select
                className="form-select"
                value={selectedTrimester}
                onChange={e => setSelectedTrimester(e.target.value)}
              >
                <option value="">Select teaching period...</option>
                {teachingPeriodsForYear.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setCoursePanelOpen(value => !value)}
              className="btn btn-sm btn-secondary"
              aria-expanded={coursePanelOpen}
            >
              {coursePanelOpen ? 'Hide Courses' : 'Show Courses'}
            </button>
            <button
              onClick={handleGenerateAll}
              className="btn btn-sm btn-primary"
              disabled={!selectedTrimester || generatingCourse === 'all' || loading || courses.length === 0}
            >
              {generatingCourse === 'all' ? 'Generating...' : 'Generate All'}
            </button>
            {selectedTrimester ? (
              <Link to={`/admin/timetable/routine/${selectedTrimester}`} className="btn btn-sm btn-secondary">
                View Routine
              </Link>
            ) : (
              <button className="btn btn-sm btn-secondary" disabled>
                View Routine
              </button>
            )}
            <button
              onClick={() => { loadCourses(); loadScheduledEntries(); }}
              className="btn btn-sm btn-secondary"
              disabled={loading}
            >
              Refresh
            </button>
          </div>
        </div>

        <div className={`timetable-main ${coursePanelOpen ? 'has-course-panel' : 'course-panel-collapsed'}`}>
          {coursePanelOpen && (
            <aside className="timetable-course-panel glass-card">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-sm text-surface-900">Courses</h3>
                    <p className="text-[11px] text-surface-500">{generatedCourses}/{courses.length} generated</p>
                  </div>
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => setCoursePanelOpen(false)}>Collapse</button>
                </div>

                {!selectedTrimester ? (
                  <div className="text-center py-6 text-surface-500 text-sm">Select a teaching period for generation</div>
                ) : loading ? (
                  <div className="text-center py-6 text-surface-400 text-sm">Loading courses...</div>
                ) : courses.length === 0 ? (
                  <div className="text-center py-6 text-surface-500 text-sm">No courses for selected filters</div>
                ) : (
                  <div className="timetable-course-list liquid-scroll">
                    {courses.map(course => {
                      const scheduledCount = getScheduledCountForCourse(course.id);
                      const generatedCount = getGeneratedCountForCourse(course);
                      const enrolled = getEnrolledStudents(course.id);
                      const numClasses = Math.ceil(enrolled / (course.classroom_type === 'lab' ? 25 : 30));
                      const hasClassesOnBoard = scheduledCount > 0;
                      const courseScheduledEntries = scheduledEntriesByCourse.get(String(course.id)) || [];
                      const isMiniMapExpanded = !!expandedMiniMaps[course.id];

                      return (
                        <div
                          key={course.id}
                          className={`rounded-xl border p-3 transition-all hover:border-brand-blue/40 hover:bg-white/80 ${hasClassesOnBoard ? 'bg-white/60 border-white/80' : 'bg-white/45 border-white/60'}`}
                        >
                          <div className="flex items-start justify-between mb-1">
                            <div>
                              <span className="font-bold text-xs text-surface-900">{course.code}</span>
                              <span className="text-xs text-surface-500 ml-2">{course.name}</span>
                            </div>
                            <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${course.classroom_type === 'lab' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                              {roomTypeLabel(course.classroom_type)}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 mb-2">
                            <label className="flex flex-col gap-1 text-[10px] text-surface-500">
                              <span>Enrolled Students</span>
                              <input
                                type="number"
                                min="0"
                                className="w-20 text-[10px] border border-white/70 bg-white/70 rounded-md px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                                placeholder="0"
                                value={enrolled || ''}
                                onChange={e => handleEnrolledStudentsChange(course.id, e.target.value)}
                              />
                            </label>
                            {enrolled > 0 && (
                              <span className="text-[10px] text-surface-500">
                                Est. classes: {numClasses}
                              </span>
                            )}
                          </div>

                          {hasClassesOnBoard ? (
                            <>
                              <div className="flex items-center gap-2 text-sm text-success">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                <span>Generated ({generatedCount} class{generatedCount === 1 ? '' : 'es'}, {scheduledCount} scheduled)</span>
                              </div>

                              <button
                                type="button"
                                onClick={() => toggleMiniMap(course.id)}
                                className="mt-2 flex w-full items-center justify-between rounded-lg border border-white/70 bg-white/65 px-2 py-1.5 text-left text-[11px] font-semibold text-surface-700 transition-colors hover:border-brand-blue hover:text-brand-blue"
                                aria-expanded={isMiniMapExpanded}
                              >
                                <span>{isMiniMapExpanded ? 'Hide' : 'Show'} Class Location Map</span>
                                <svg
                                  className={`mini-map-chevron ${isMiniMapExpanded ? 'is-open' : ''}`}
                                  viewBox="0 0 20 20"
                                  fill="none"
                                  aria-hidden="true"
                                >
                                  <path d="M5 7.5 10 12.5 15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </button>

                              {isMiniMapExpanded && (
                                <ClassLocationMiniMap
                                  classrooms={classrooms}
                                  courseEntries={courseScheduledEntries}
                                  onFocusEntry={focusEntryOnBoard}
                                />
                              )}

                              {generatedCount > scheduledCount && (
                                <button
                                  type="button"
                                  onClick={() => handleScheduleGeneratedClasses(course)}
                                  className="btn btn-primary btn-sm mt-2 w-full"
                                  disabled={!selectedTrimester || generatingCourse === `schedule-${course.id}`}
                                >
                                  {generatingCourse === `schedule-${course.id}` ? 'Scheduling...' : 'Auto Schedule Missing'}
                                </button>
                              )}
                            </>
                          ) : (
                            <button
                              onClick={() => handleGenerateClass(course.id)}
                              className="btn btn-primary btn-sm w-full"
                              disabled={!selectedTrimester || generatingCourse === course.id || enrolled === 0}
                            >
                              {generatingCourse === course.id ? 'Generating...' : 'Generate Class'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
            </aside>
          )}

            <section className="timetable-board-shell" ref={boardShellRef}>
              <div className="timetable-board-title">
                <div>
                  <h3 className="text-sm font-black text-brand-dark">Room timetable board</h3>
                  <p className="text-xs text-surface-500">{classrooms.length} rooms, {DAYS.length} days, {scheduledEntries.length} scheduled classes</p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <div className="zoom-control" aria-label="Timetable board zoom controls">
                    <button type="button" onClick={() => changeBoardZoom('out')} disabled={boardZoom <= ZOOM_MIN} aria-label="Zoom out">-</button>
                    <span>{Math.round(boardZoom * 100)}%</span>
                    <button type="button" onClick={() => changeBoardZoom('in')} disabled={boardZoom >= ZOOM_MAX} aria-label="Zoom in">+</button>
                    <button type="button" className="zoom-fit" onClick={() => changeBoardZoom('fit')}>Fit Screen</button>
                    <button type="button" className="zoom-reset" onClick={() => changeBoardZoom('reset')} disabled={boardZoom === 1}>Reset</button>
                  </div>
                  {!coursePanelOpen && (
                    <button type="button" className="btn btn-sm btn-secondary" onClick={() => setCoursePanelOpen(true)}>Show Courses</button>
                  )}
                </div>
              </div>

              <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <div className={`glass-card timetable-dnd-board liquid-scroll ${isBoardDragging ? 'is-board-dragging' : ''}`} style={boardZoomStyle}>
                  {classrooms.length === 0 ? (
                    <div className="p-12 text-center text-surface-500">No available classrooms</div>
                  ) : (
                    <div style={{ minWidth: boardMinWidth }}>
                      <div
                        className="grid timetable-board-header"
                        style={{ gridTemplateColumns: boardGridTemplateColumns }}
                      >
                        <div className="timetable-corner-cell">
                          Time
                        </div>

                        {classrooms.map(room => (
                          <div
                            key={room.id}
                            className={`timetable-room-header ${room.type === 'lab' ? 'bg-amber-50/80' : 'bg-blue-50/80'}`}
                            style={{ gridColumn: `span ${DAYS.length} / span ${DAYS.length}` }}
                            title={`${room.room_number} | ${roomTypeLabel(room.type)} room | Capacity ${room.max_capacity || 'N/A'}`}
                          >
                            <span className="room-number-label">{room.room_number}</span>
                            <span className={`room-type-pill ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${room.type === 'lab' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                              {roomTypeLabel(room.type)}
                            </span>
                          </div>
                        ))}

                        {classrooms.map(room => (
                          DAYS.map(day => (
                            <div
                              key={`${room.id}-${day}-header`}
                              className="timetable-day-header"
                              style={{ borderLeft: `3px solid ${DAY_COLORS[day]}` }}
                              title={`${room.room_number} | ${day}`}
                            >
                              {DAY_SHORT_LABELS[day] || day.substring(0, 3)}
                            </div>
                          ))
                        ))}
                      </div>

                      <div
                        className="grid timetable-grid-body"
                        style={{ gridTemplateColumns: boardGridTemplateColumns }}
                      >
                        {TIME_SLOTS.map((slot, slotIndex) => (
                          <Fragment key={slot}>
                            <div className="timetable-time-cell" title={`Start time ${slot}`}>
                              <span>{slot}</span>
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
                                        className={`timetable-drop-cell ${cellEntries.length > 0 ? 'has-entry' : ''} ${slotIndex % 2 === 0 ? 'bg-white/42' : 'bg-white/28'} ${snapshot.isDraggingOver ? 'is-over' : ''}`}
                                      >
                                        {cellEntries.map((entry, entryIndex) => {
                                          const { height } = calculateCardStyle(entry);
                                          const dayColor = DAY_COLORS[day] || '#6366f1';
                                          const hasTutorAvailabilityConflict = Boolean(entry.tutor_availability_conflict);

                                          return (
                                            <Draggable key={entry.id} draggableId={String(entry.id)} index={entryIndex}>
                                              {(provided, snapshot) => (
                                                <TimetableEntryCard
                                                  entry={entry}
                                                  provided={provided}
                                                  snapshot={snapshot}
                                                  height={height}
                                                  zoomLevel={boardZoom}
                                                  dayColor={dayColor}
                                                  focused={String(focusedEntryId) === String(entry.id)}
                                                  hasWarning={hasTutorAvailabilityConflict}
                                                  borderClass={colors.border}
                                                  onEntryClick={handleEntryClick}
                                                />
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
            </section>
          </div>
        </div>

      <Modal 
        isOpen={showScheduleModal} 
        onClose={() => setShowScheduleModal(false)} 
        title={editingEntry ? 'Edit Timetable Entry' : 'Schedule Class'}
        size="lg"
      >
        <form onSubmit={handleScheduleSubmit} className="space-y-4">
          {editingEntry?.tutor_availability_conflict && (
            <div className="alert-card alert-warning">
              Current tutor is no longer available at this time. Assign a new tutor or move the class.
            </div>
          )}

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

