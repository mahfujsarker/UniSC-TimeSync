/**
 * Academic Calendar Page
 * Displays published AcademicYear and TeachingPeriod records.
 */
import { useEffect, useState } from 'react';
import CrudManager from './CrudManager';
import api from '../../api/axios';

const dateFields = [
  ['start_date', 'Start'],
  ['end_date', 'End'],
  ['classes_start_date', 'Classes start'],
  ['classes_end_date', 'Classes end'],
  ['census_date', 'Census'],
  ['exam_start_date', 'Exam start'],
  ['exam_end_date', 'Exam end'],
  ['grades_release_date', 'Grades release']
];

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString();
}

function formatDateTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString();
}

function periodTypeLabel(type) {
  const normalized = String(type || '').toUpperCase();
  if (normalized === 'TRIMESTER') return 'Trimester';
  if (normalized === 'SESSION') return 'Session';
  if (normalized === 'SEMESTER') return 'Semester';
  return 'Other';
}

export default function CalendarManager() {
  const [academicYears, setAcademicYears] = useState([]);
  const [teachingPeriods, setTeachingPeriods] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get('/calendar/published'),
      api.get('/trimesters?status=published')
    ])
      .then(([calendarRes, periodsRes]) => {
        if (!active) return;
        setAcademicYears(calendarRes.data);
        setTeachingPeriods(periodsRes.data.filter(period => period.status === 'published'));
      })
      .catch(() => {
        if (active) setAcademicYears([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <p className="page-kicker">Published calendar</p>
          <h2 className="page-title" style={{ fontFamily: 'var(--font-heading)' }}>Academic Calendar</h2>
          <p className="page-subtitle">Published academic years and teaching periods approved from the Teaching Period page.</p>
        </div>
      </div>

      {loading ? (
        <div className="glass-card p-12 text-center text-surface-400">Loading academic calendar...</div>
      ) : academicYears.length === 0 ? (
        <div className="empty-state">No published academic calendar available yet.</div>
      ) : (
        <div className="space-y-6">
          {academicYears.map(year => (
            <section key={year.id} className="glass-card overflow-hidden">
              <div className="border-b border-white/70 bg-white/60 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="page-kicker">Academic year</p>
                    <h3 className="section-title">{year.year}</h3>
                    <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-surface-600 md:grid-cols-3">
                      <div><span className="font-semibold text-surface-800">Source URL:</span> {year.source_url ? <a className="text-brand-blue hover:underline" href={year.source_url} target="_blank" rel="noreferrer">{year.source_url}</a> : ''}</div>
                      <div><span className="font-semibold text-surface-800">Last synced/imported:</span> {formatDateTime(year.last_synced_at)}</div>
                      <div><span className="font-semibold text-surface-800">Status:</span> <span className="badge badge-success">{year.status}</span></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="data-table min-w-[1300px]">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Code</th>
                      <th>Name</th>
                      {dateFields.map(([, label]) => <th key={label}>{label}</th>)}
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(year.teaching_periods || []).map(period => (
                      <tr key={period.id}>
                        <td>{periodTypeLabel(period.type)}</td>
                        <td><span className="badge bg-[#e6eeff] text-[#0044a3]">{period.code}</span></td>
                        <td className="font-semibold text-surface-900">{period.name}</td>
                        {dateFields.map(([key]) => <td key={key}>{formatDate(period[key])}</td>)}
                        <td><span className="badge badge-success">{period.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {(year.teaching_periods || []).some(period => (period.events || []).length > 0) && (
                <div className="border-t border-white/70 p-4">
                  <h4 className="mb-3 text-sm font-bold text-surface-900">Important Academic Events</h4>
                  <div className="space-y-3">
                    {year.teaching_periods.map(period => (
                      (period.events || []).length > 0 && (
                        <div key={`${period.id}-events`}>
                          <div className="mb-1 text-xs font-bold text-surface-600">{period.name}</div>
                          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                            {period.events.map((event, index) => (
                              <div key={`${period.id}-${index}`} className="rounded-lg border border-white/70 bg-white/60 p-3 text-sm">
                                <div className="font-semibold text-surface-900">{event.title}</div>
                                <div className="text-xs text-surface-500">{event.event_type}</div>
                                <div className="mt-1 text-xs text-surface-600">
                                  {formatDate(event.start_date)}{event.end_date ? ` - ${formatDate(event.end_date)}` : ''}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      <div className="mt-8">
        <CrudManager
          title="Academic Events"
          apiPath="/calendar"
          entityName="Calendar Event"
          columns={[
            { key: 'name', label: 'Event' },
            { key: 'trimester_name', label: 'Teaching Period' },
            { key: 'start_date', label: 'Start', render: (item) => formatDate(item.start_date) },
            { key: 'end_date', label: 'End', render: (item) => formatDate(item.end_date) },
          ]}
          formFields={[
            { name: 'name', label: 'Event Name', placeholder: 'e.g. Teaching Period', required: true },
            { name: 'trimester_id', label: 'Teaching Period', type: 'select', options: teachingPeriods.map(t => ({ value: t.id, label: t.name })) },
            { name: 'start_date', label: 'Start Date', type: 'date', required: true },
            { name: 'end_date', label: 'End Date', type: 'date', required: true },
          ]}
        />
      </div>
    </div>
  );
}
