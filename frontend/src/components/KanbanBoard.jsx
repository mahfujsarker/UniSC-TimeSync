/**
 * Kanban Board for Timetable Visualization
 * Uses @hello-pangea/dnd for drag-and-drop.
 * Read-only mode for admins viewing scheduled classes.
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
      <div className="overflow-x-auto">
        <div className="grid grid-cols-5 gap-4 min-w-[900px]">
          {DAYS.map(day => (
            <Droppable key={day} droppableId={day} isDropDisabled={readOnly}>
              {(provided, snapshot) => (
                <div
                  className={`rounded-lg ${snapshot.isDraggingOver ? 'bg-green-50' : 'bg-surface-50'} min-h-[200px] p-2`}
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                >
                  <div 
                    className="kanban-column-header flex items-center justify-between px-3 py-2 rounded-t-lg mb-2"
                    style={{ 
                      backgroundColor: DAY_COLORS[day] + '20',
                      borderLeft: `4px solid ${DAY_COLORS[day]}`
                    }}
                  >
                    <span className="font-semibold text-sm text-surface-800">{day}</span>
                    <span 
                      className="px-2 py-0.5 rounded-full text-xs font-bold"
                      style={{ backgroundColor: DAY_COLORS[day], color: 'white' }}
                    >
                      {(data[day] || []).length}
                    </span>
                  </div>

                  {(data[day] || []).length === 0 && (
                    <div className="text-center py-6 text-surface-400 text-xs border-2 border-dashed border-surface-200 rounded-lg mx-1">
                      No classes
                    </div>
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
                          className={`kanban-card mb-2 ${snapshot.isDragging ? 'is-dragging shadow-lg' : ''}`}
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          style={{
                            borderLeftColor: DAY_COLORS[day],
                            borderLeftWidth: 4,
                            ...provided.draggableProps.style
                          }}
                          onClick={() => onCardClick?.(entry)}
                        >
                          <div className="flex items-start justify-between mb-1">
                            <div className="kanban-card-title font-bold text-sm text-surface-900">
                              {entry.unit_code || 'N/A'}
                            </div>
                            {entry.is_recurring && (
                              <span className="text-[8px] bg-surface-200 px-1 rounded">Recurring</span>
                            )}
                          </div>
                          <div className="text-xs text-brand-dark mb-1 font-medium">
                            {entry.unit_name || 'Unknown Unit'}
                          </div>
                          <div className="text-xs text-surface-600 mb-1">
                            {entry.group_name}
                          </div>
                          <div className="kanban-card-meta space-y-0.5">
                            <div className="flex items-center gap-1 text-xs text-surface-600">
                              <span>🕐</span>
                              <span>{entry.start_time?.substring(0, 5)} – {entry.end_time?.substring(0, 5)}</span>
                              <span className="text-surface-400">({calculateDuration(entry.start_time, entry.end_time)})</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-surface-600">
                              <span>📍</span>
                              <span>{entry.room_number || 'TBA'}{entry.room_location ? ` (${entry.room_location})` : ''}</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-surface-600">
                              <span>👤</span>
                              <span>{entry.tutor_name || 'TBA'}</span>
                            </div>
                          </div>
                          {entry.enrolled_count !== undefined && (
                            <div className="mt-2 flex items-center gap-2">
                              <div className="h-1.5 flex-1 bg-surface-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${Math.min((entry.enrolled_count / (entry.max_capacity || 1)) * 100, 100)}%`,
                                    backgroundColor: entry.enrolled_count >= entry.max_capacity
                                      ? '#ef4444'
                                      : DAY_COLORS[day],
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
      </div>
    </DragDropContext>
  );
}
