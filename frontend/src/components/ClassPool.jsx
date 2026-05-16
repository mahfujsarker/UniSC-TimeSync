/**
 * ClassPool Component
 * Displays unscheduled class cards in a draggable pool.
 */
import { Draggable } from '@hello-pangea/dnd';

const ROOM_TYPE_COLORS = {
  lab: { bg: 'bg-amber-50', border: 'border-amber-300', badge: 'badge-warning' },
  normal: { bg: 'bg-blue-50', border: 'border-blue-300', badge: 'badge-primary' }
};

export default function ClassPool({ classes, onClassClick, readOnly = false }) {
  if (!classes || classes.length === 0) {
    return (
      <div className="class-pool-empty bg-surface-50 rounded-lg p-6 text-center">
        <div className="text-3xl mb-2">📋</div>
        <p className="text-surface-500 text-sm">No unscheduled classes</p>
        <p className="text-surface-400 text-xs mt-1">Create courses to generate classes</p>
      </div>
    );
  }

  const groupedClasses = classes.reduce((acc, cls) => {
    const key = cls.unit_code;
    if (!acc[key]) acc[key] = [];
    acc[key].push(cls);
    return acc;
  }, {});

  return (
    <div className="class-pool">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm text-brand-dark">Unscheduled Classes</h3>
        <span className="badge badge-primary">{classes.length}</span>
      </div>
      
      <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
        {Object.entries(groupedClasses).map(([courseCode, courseClasses]) => (
          <div key={courseCode} className="course-group">
            <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-1.5 px-1">
              {courseCode}
            </div>
            {courseClasses.map((cls, index) => {
              const colors = ROOM_TYPE_COLORS[cls.required_room_type] || ROOM_TYPE_COLORS.normal;
              return (
                <Draggable
                  key={cls.id}
                  draggableId={`pool-${cls.id}`}
                  index={index}
                  isDragDisabled={readOnly}
                >
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className={`class-card ${colors.bg} ${colors.border} border rounded-md p-3 mb-2 cursor-grab transition-all ${
                        snapshot.isDragging ? 'shadow-lg rotate-2 scale-[1.02]' : 'hover:shadow-md'
                      }`}
                      onClick={() => onClassClick?.(cls)}
                    >
                      <div className="flex items-start justify-between mb-1.5">
                        <div>
                          <span className={`badge ${colors.badge} text-[10px]`}>
                            {cls.required_room_type === 'lab' ? 'Lab' : 'Normal'}
                          </span>
                          <span className="ml-2 font-semibold text-[13px] text-brand-dark">
                            {cls.group_name}
                          </span>
                        </div>
                      </div>
                      
                      <div className="text-xs text-surface-600 font-medium">
                        {cls.unit_name}
                      </div>
                      
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-surface-500">
                        <span>⏱ {cls.duration}h</span>
                        <span>👥 {cls.max_capacity}</span>
                      </div>
                    </div>
                  )}
                </Draggable>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
