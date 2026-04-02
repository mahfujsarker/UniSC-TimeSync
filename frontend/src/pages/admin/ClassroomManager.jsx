/**
 * Classroom Manager Page
 */
import CrudManager from './CrudManager';

export default function ClassroomManager() {
  return (
    <CrudManager
      title="Classroom Management"
      apiPath="/classrooms"
      entityName="Classroom"
      columns={[
        { key: 'room_number', label: 'Room No.' },
        { key: 'location', label: 'Location' },
        { key: 'max_capacity', label: 'Capacity' },
        { key: 'type', label: 'Type', render: (item) => (
          <span className={`badge ${item.type === 'lab' ? 'badge-warning' : 'badge-success'}`}>{item.type}</span>
        )},
        { key: 'is_available', label: 'Status', render: (item) => (
          <span className={`badge ${item.is_available ? 'badge-success' : 'badge-danger'}`}>
            {item.is_available ? 'Available' : 'Unavailable'}
          </span>
        )},
      ]}
      formFields={[
        { name: 'room_number', label: 'Room Number', placeholder: 'e.g. L101', required: true },
        { name: 'location', label: 'Location', placeholder: 'e.g. Building A' },
        { name: 'max_capacity', label: 'Max Capacity', type: 'number', placeholder: '30', required: true },
        { name: 'type', label: 'Room Type', type: 'select', required: true, options: [{ value: 'normal', label: 'Normal' }, { value: 'lab', label: 'Lab' }] },
      ]}
    />
  );
}
