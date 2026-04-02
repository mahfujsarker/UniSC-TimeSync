/**
 * TimetableGrid Component
 * Interactive grid with classrooms as columns and time slots as rows.
 * Supports drag-and-drop scheduling from the class pool.
 */
import { useState, useMemo } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';

const TIME_SLOTS = [];
for (let hour = 8; hour < 22; hour++) {
  TIME_SLOTS.push(`${hour.toString().padStart(2, '0')}:00`);
  TIME_SLOTS.push(`${hour.toString().padStart(2, '0')}:30`);
}

const ROOM_TYPE_COLORS = {
  lab: { header: 'bg-amber-100', card: 'bg-amber-50 border-amber-300' },
  normal: { header: 'bg-blue-100', card: 'bg-blue-50 border-blue-300' }
};

const DAY_COLORS = {
  Monday: '#6366f1',
  Tuesday: '#8b5cf6',
  Wednesday: '#06b6d4',
  Thursday: '#f59e0b',
  Friday: '#10b981',
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export default function TimetableGrid({ 
  classrooms, 
  entries, 
  selectedDay,
  onSlotDrop,
  onEntryClick,
  readOnly = false,
  unscheduledClasses = []
}) {
  const [hoveredSlot, setHoveredSlot] = useState(null);

  const getEntriesForCell = (classroomId, timeSlot) => {
    return entries.filter(entry => {
      if (entry.classroom_id !== classroomId) return false;
      if (selectedDay && entry.day_of_week !== selectedDay) return false;
      
      const entryStart = entry.start_time.substring(0, 5);
      const entryEnd = entry.end_time.substring(0, 5);
      return entryStart === timeSlot;
    });
  };

  const calculateCardHeight = (entry) => {
    const startParts = entry.start_time.split(':');
    const endParts = entry.end_time.split(':');
    const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
    const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);
    const durationMinutes = endMinutes - startMinutes;
    const slotHeight = 60;
    return Math.max((durationMinutes / 30) * slotHeight, slotHeight);
  };

  const getSlotDroppableId = (classroomId, timeSlot) => {
    return `slot-${classroomId}-${timeSlot}`;
  };

  return (
    <div className="timetable-grid-container overflow-x-auto">
      <div className="min-w-[800px]">
        <div className="flex">
          <div className="time-column w-16 flex-shrink-0">
            <div className="header-cell h-12 bg-surface-100 border-b border-surface-200" />
            {TIME_SLOTS.map(slot => (
              <div 
                key={slot} 
                className="time-slot-label h-[60px] flex items-center justify-end pr-2 text-xs text-surface-500 font-medium border-r border-surface-200"
              >
                {slot}
              </div>
            ))}
          </div>

          {classrooms.map(classroom => {
            const colors = ROOM_TYPE_COLORS[classroom.type] || ROOM_TYPE_COLORS.normal;
            return (
              <div key={classroom.id} className="classroom-column flex-1 min-w-[160px]">
                <div className={`header-cell h-12 ${colors.header} border-b border-surface-300 flex items-center justify-center`}>
                  <div className="text-center">
                    <div className="font-semibold text-xs text-brand-dark">{classroom.room_number}</div>
                    <div className="text-[10px] text-surface-500">{classroom.location || 'N/A'}</div>
                  </div>
                </div>

                {TIME_SLOTS.map((slot, slotIndex) => {
                  const cellEntries = getEntriesForCell(classroom.id, slot);
                  const droppableId = getSlotDroppableId(classroom.id, slot);
                  const isHovered = hoveredSlot === droppableId;
                  
                  return (
                    <Droppable 
                      key={droppableId} 
                      droppableId={droppableId}
                      isDropDisabled={readOnly}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`time-slot-cell h-[60px] border-b border-r border-surface-200 relative transition-colors ${
                            snapshot.isDraggingOver ? 'bg-brand-yellow/20' : 
                            isHovered ? 'bg-surface-50' : ''
                          } ${slotIndex % 2 === 0 ? 'bg-white' : 'bg-surface-50/50'}`}
                          onMouseEnter={() => setHoveredSlot(droppableId)}
                          onMouseLeave={() => setHoveredSlot(null)}
                        >
                          {cellEntries.length === 0 && !snapshot.isDraggingOver && (
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                              {!readOnly && (
                                <span className="text-[10px] text-surface-400">Drop here</span>
                              )}
                            </div>
                          )}

                          {cellEntries.map((entry, index) => {
                            const isFirstSlot = entry.start_time.substring(0, 5) === slot;
                            if (!isFirstSlot) return null;

                            const height = calculateCardHeight(entry);
                            const dayColor = DAY_COLORS[entry.day_of_week] || '#6366f1';

                            return (
                              <Draggable
                                key={entry.id}
                                draggableId={entry.id}
                                index={0}
                                isDragDisabled={readOnly}
                              >
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={`scheduled-card absolute left-1 right-1 rounded-md p-2 cursor-grab transition-all overflow-hidden ${
                                      colors.card
                                    } ${snapshot.isDragging ? 'shadow-lg rotate-1 scale-[1.02] z-50' : 'hover:shadow-md'}`}
                                    style={{
                                      height: `${height}px`,
                                      top: '2px',
                                      borderLeft: `3px solid ${dayColor}`,
                                      ...provided.draggableProps.style
                                    }}
                                    onClick={() => onEntryClick?.(entry)}
                                  >
                                    <div className="flex items-start justify-between mb-1">
                                      <span className="font-semibold text-[11px] text-brand-dark">
                                        {entry.unit_code}
                                      </span>
                                      {entry.is_recurring && (
                                        <span className="text-[8px] text-surface-400">🔄</span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-surface-600 font-medium truncate">
                                      {entry.unit_name}
                                    </div>
                                    <div className="text-[9px] text-surface-500 mt-1">
                                      {entry.group_name} • {entry.start_time.substring(0,5)} - {entry.end_time.substring(0,5)}
                                    </div>
                                    <div className="text-[9px] text-surface-400 truncate">
                                      {entry.tutor_name}
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
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
