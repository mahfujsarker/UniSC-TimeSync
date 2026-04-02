/**
 * Kanban Board for Timetable Visualization
 * Uses @hello-pangea/dnd for drag-and-drop.
 * Read-only mode for students.
 */
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { calculateDuration } from '../utils/timeUtils';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const DAY_COLORS = {
  Monday: '#6366f1',
  Tuesday: '#8b5cf6',
  Wednesday: '#06b6d4',
  Thursday: '#f59e0b',
  Friday: '#10b981',
};

export default function KanbanBoard({ data, onDragEnd, onCardClick, readOnly = false }) {
  const handleDragEnd = (result) => {
    if (!result.destination || readOnly) return;
    onDragEnd?.(result);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="kanban-board">
        {DAYS.map(day => (
          <Droppable key={day} droppableId={day} isDropDisabled={readOnly}>
            {(provided, snapshot) => (
              <div
                className="kanban-column"
                ref={provided.innerRef}
                {...provided.droppableProps}
              >
                <div className="kanban-column-header" style={{ borderLeftColor: DAY_COLORS[day], borderLeftWidth: 3 }}>
                  <span>{day}</span>
                  <span className="badge badge-primary">{(data[day] || []).length}</span>
                </div>

                {(data[day] || []).length === 0 && (
                  <div className="text-center py-8 text-surface-500 text-xs">No classes</div>
                )}

                {(data[day] || []).map((entry, index) => (
                  <Draggable
                    key={entry.id}
                    draggableId={entry.id}
                    index={index}
                    isDragDisabled={readOnly}
                  >
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={`kanban-card ${snapshot.isDragging ? 'is-dragging' : ''}`}
                        style={{
                          borderLeftColor: DAY_COLORS[day],
                          borderLeftWidth: 4
                        }}
                        onClick={() => onCardClick?.(entry)}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <div className="kanban-card-title">{entry.unit_code || 'N/A'}</div>
                          {entry.is_recurring && (
                            <span className="text-[8px] bg-surface-200 px-1 rounded">🔄</span>
                          )}
                        </div>
                        <div className="text-xs text-brand-dark mb-1 font-medium">
                          {entry.unit_name || 'Unknown Unit'}
                        </div>
                        <div className="text-xs text-surface-600 mb-1">
                          {entry.group_name}
                        </div>
                        <div className="kanban-card-meta">
                          <span>🕐 {entry.start_time?.substring(0, 5)} – {entry.end_time?.substring(0, 5)} ({calculateDuration(entry.start_time, entry.end_time)})</span>
                          <span>📍 {entry.room_number || 'TBA'}{entry.room_location ? ` (${entry.room_location})` : ''}</span>
                          <span>👤 {entry.tutor_name || 'TBA'}</span>
                        </div>
                        {entry.enrolled_count !== undefined && (
                          <div className="mt-2 flex items-center gap-2">
                            <div className="h-1.5 flex-1 bg-surface-700 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.min((entry.enrolled_count / (entry.max_capacity || 1)) * 100, 100)}%`,
                                  background: entry.enrolled_count >= entry.max_capacity
                                    ? 'var(--color-danger)'
                                    : 'var(--color-primary-500)',
                                }}
                              />
                            </div>
                            <span className="text-xs text-surface-400">
                              {entry.enrolled_count}/{entry.max_capacity || '?'}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        ))}
      </div>
    </DragDropContext>
  );
}
