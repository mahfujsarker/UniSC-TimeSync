/**
 * Tutor Manager Page
 */
import CrudManager from './CrudManager';

export default function TutorManager() {
  return (
    <CrudManager
      title="Tutor Management"
      apiPath="/tutors"
      entityName="Tutor"
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'assigned_units', label: 'Assigned Units', render: (item) => {
          const units = item.assigned_units || [];
          if (units.length === 0) return <span className="text-surface-500">None</span>;
          return (
            <div className="flex flex-wrap gap-1">
              {units.map((u, i) => (
                <span key={i} className="badge badge-primary">{u.unit_code}</span>
              ))}
            </div>
          );
        }},
      ]}
      formFields={[
        { name: 'name', label: 'Full Name', placeholder: 'Dr. Jane Doe', required: true },
        { name: 'email', label: 'Email', type: 'email', placeholder: 'jane.doe@uni.edu', required: true },
      ]}
    />
  );
}
