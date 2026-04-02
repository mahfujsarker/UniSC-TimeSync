/**
 * Calendar Manager Page
 */
import { useState, useEffect } from 'react';
import CrudManager from './CrudManager';
import api from '../../api/axios';

export default function CalendarManager() {
  const [trimesters, setTrimesters] = useState([]);

  useEffect(() => {
    api.get('/trimesters').then(res => setTrimesters(res.data)).catch(() => {});
  }, []);

  return (
    <CrudManager
      title="Academic Calendar"
      apiPath="/calendar"
      entityName="Calendar Event"
      columns={[
        { key: 'name', label: 'Event' },
        { key: 'trimester_name', label: 'Trimester' },
        { key: 'start_date', label: 'Start', render: (item) => new Date(item.start_date).toLocaleDateString() },
        { key: 'end_date', label: 'End', render: (item) => new Date(item.end_date).toLocaleDateString() },
      ]}
      formFields={[
        { name: 'name', label: 'Event Name', placeholder: 'e.g. Teaching Period', required: true },
        { name: 'trimester_id', label: 'Trimester', type: 'select', options: trimesters.map(t => ({ value: t.id, label: t.name })) },
        { name: 'start_date', label: 'Start Date', type: 'date', required: true },
        { name: 'end_date', label: 'End Date', type: 'date', required: true },
      ]}
    />
  );
}
