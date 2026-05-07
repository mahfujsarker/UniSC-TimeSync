import {
  ROUTINE_DAYS,
  ROUTINE_TIME_SLOTS,
  buildRoutineCells,
  getRoutineCellEntries,
  getSlotRange
} from '../utils/timetableRoutine';

export default function RoutineTable({ entries }) {
  const cells = buildRoutineCells(entries);

  return (
    <div className="overflow-auto border border-surface-200 rounded-lg bg-white">
      <table className="w-full min-w-[1100px] border-collapse">
        <thead>
          <tr>
            <th className="sticky left-0 top-0 z-20 w-32 bg-surface-100 border-b border-r border-surface-200 px-3 py-3 text-left text-xs font-bold text-surface-700">
              Time
            </th>
            {ROUTINE_DAYS.map(day => (
              <th
                key={day}
                className="sticky top-0 z-10 bg-surface-100 border-b border-r border-surface-200 px-3 py-3 text-center text-xs font-bold text-surface-700"
              >
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROUTINE_TIME_SLOTS.map(slot => (
            <tr key={slot}>
              <th className="sticky left-0 z-10 bg-surface-50 border-b border-r border-surface-200 px-3 py-3 text-left text-xs font-semibold text-surface-600">
                {getSlotRange(slot)}
              </th>
              {ROUTINE_DAYS.map(day => {
                const cellEntries = getRoutineCellEntries(cells, day, slot);

                return (
                  <td
                    key={`${day}-${slot}`}
                    className="h-24 align-top border-b border-r border-surface-200 bg-white px-2 py-2"
                  >
                    <div className="space-y-2">
                      {cellEntries.map(entry => (
                        <div
                          key={entry.id}
                          className="rounded-md border border-blue-200 bg-blue-50 p-2 text-[11px] leading-snug text-surface-800"
                        >
                          <div className="font-bold text-surface-900">
                            {entry.unit_name || 'Unknown Unit'} ({entry.unit_code || 'N/A'})
                          </div>
                          <div>Room: {entry.room_number || 'TBA'}</div>
                          <div>Tutor: {entry.tutor_name || 'TBA'}</div>
                          <div>
                            Degree: {entry.degrees?.length ? entry.degrees.join(', ') : entry.degree_name || 'N/A'}
                          </div>
                          <div>
                            Time: {entry.start_time?.substring(0, 5)}-{entry.end_time?.substring(0, 5)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
