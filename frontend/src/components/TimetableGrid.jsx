/**
 * TimetableGrid Component - Room-based Weekly Timetable
 * Layout: Time on left, Rooms across top, Weekdays under each room
 * Supports drag-and-drop across rooms, days, and time slots
 */
import { useState } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';

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

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const ROOM_TYPE_COLORS = {
  lab: { header: 'bg-amber-100', card: 'bg-amber-50 border-amber-300' },
  normal: { header: 'bg-blue-100', card: 'bg-blue-50 border-blue-300' }
};

export default function TimetableGrid({
  classrooms,
  entries,
  selectedDay,
  onEntryClick,
  readOnly = false
}) {
  const [hoveredSlot, setHoveredSlot] = useState(null);

  const getEntriesForCell = (classroomId, timeSlot, day) => {
    return entries.filter(entry => {
      if (entry.classroom_id !== classroomId) return false;
      if (selectedDay && entry.day_of_week !== selectedDay) return false;
      if (day && entry.day_of_week !== day) return false;

      const entryStart = entry.start_time.substring(0, 5);
      return entryStart === timeSlot;
    });
  };

  const calculateCardHeight = (entry) => {
    const startParts = entry.start_time.split(':');
    const endParts = entry.end_time.split(':');
    const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
    const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);
    const durationMinutes = endMinutes - startMinutes;
    const slotHeight = 48;
    const slots = durationMinutes / 30;
    return slots * slotHeight - 4;
  };

  const getSlotDroppableId = (classroomId, timeSlot, day) => {
    return `${classroomId}|${timeSlot}|${day}`;
  };

  return (
    <div className="timetable-grid-container overflow-x-auto liquid-scroll">
      <div className="min-w-[900px]">
        <div className="flex sticky top-0 z-10">
          <div className="w-20 flex-shrink-0 timetable-board-header border-b border-r border-white/70 h-14" />

          {classrooms.map(room => (
            <div
              key={room.id}
              className={`flex-1 min-w-[300px] border-b border-white/70 h-14 flex ${ROOM_TYPE_COLORS[room.type]?.header || ROOM_TYPE_COLORS.normal.header}`}
            >
              {DAYS.map(day => (
                <div
                  key={`${room.id}-${day}`}
                  className="flex-1 flex items-center justify-center text-xs font-bold border-r border-white/70 last:border-r-0 bg-white/55"
                  style={{ borderLeft: `3px solid ${DAY_COLORS[day]}` }}
                >
                  {room.room_number} - {day}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="flex">
          <div className="w-20 flex-shrink-0">
            <div className="h-8 border-b border-r border-white/70 bg-white/65" />
            {TIME_SLOTS.map(slot => (
              <div
                key={slot}
                className="h-12 flex items-center justify-end pr-2 text-[10px] text-surface-600 font-semibold border-b border-r border-white/70 bg-white/70 backdrop-blur"
              >
                {slot}
              </div>
            ))}
          </div>

          {classrooms.map(room => {
            const colors = ROOM_TYPE_COLORS[room.type] || ROOM_TYPE_COLORS.normal;

            return (
              <div
                key={room.id}
                className="flex-1 min-w-[300px] border-r border-white/70 last:border-r-0"
              >
                <div className="flex">
                  {DAYS.map(day => (
                    <div key={`${room.id}-${day}`} className="flex-1 min-w-[60px]">
                      {TIME_SLOTS.map((slot, slotIndex) => {
                        const droppableId = getSlotDroppableId(room.id, slot, day);
                        const cellEntries = getEntriesForCell(room.id, slot, day);
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
                                className={`timetable-drop-cell last:border-r-0 ${
                                  snapshot.isDraggingOver ? 'bg-brand-yellow/20' :
                                  isHovered ? 'bg-surface-50' : ''
                                } ${slotIndex % 2 === 0 ? 'bg-white' : 'bg-surface-50/50'}`}
                                onMouseEnter={() => setHoveredSlot(droppableId)}
                                onMouseLeave={() => setHoveredSlot(null)}
                              >
                                {cellEntries.map(entry => {
                                  const isFirstSlot = entry.start_time.substring(0, 5) === slot;
                                  if (!isFirstSlot) return null;

                                  const dayColor = DAY_COLORS[entry.day_of_week] || '#6366f1';
                                  const height = calculateCardHeight(entry);

                                  return (
                                    <Draggable
                                      key={entry.id}
                                      draggableId={String(entry.id)}
                                      index={0}
                                      isDragDisabled={readOnly}
                                    >
                                      {(provided, snapshot) => (
                                        <div
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          {...provided.dragHandleProps}
                                          className={`absolute left-0.5 right-0.5 timetable-entry-card text-[9px] ${colors.card} ${snapshot.isDragging ? 'is-dragging z-50 scale-[1.02]' : ''}`}
                                          style={{
                                            height: `${height}px`,
                                            top: '2px',
                                            borderLeft: `2px solid ${dayColor}`,
                                            ...provided.draggableProps.style
                                          }}
                                          onClick={() => onEntryClick?.(entry)}
                                        >
                                          <div className="font-bold text-[9px] truncate">{entry.unit_code}</div>
                                          <div className="text-[8px] truncate">
                                            {entry.start_time?.substring(0,5)}-{entry.end_time?.substring(0,5)}
                                          </div>
                                        </div>
                                      )}
                                    </Draggable>
                                  );
                                })}

                                {cellEntries.length === 0 && !snapshot.isDraggingOver && (
                                  <div className="absolute inset-0 flex items-center justify-center text-[8px] text-surface-300">
                                    Free
                                  </div>
                                )}

                                {provided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
