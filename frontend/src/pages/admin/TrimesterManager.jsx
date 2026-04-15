/**
 * Trimester Manager Page
 */
import CrudManager from './CrudManager';

export default function TrimesterManager() {

  return (
    <CrudManager
      title="Trimester Management"
      apiPath="/trimesters"
      entityName="Trimester"
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'start_date', label: 'Start', render: (item) => new Date(item.start_date).toLocaleDateString() },
        { key: 'end_date', label: 'End', render: (item) => new Date(item.end_date).toLocaleDateString() },
      ]}
      formFields={[
        { name: 'name', label: 'Trimester Name', placeholder: 'e.g. Trimester 1 2026', required: true },
        { name: 'start_date', label: 'Start Date', type: 'date', required: true },
        { name: 'end_date', label: 'End Date', type: 'date', required: true },
      ]}
    />
  );
}
