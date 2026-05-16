/**
 * Admin Dashboard - Main layout and live overview.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardShell from '../../components/DashboardShell';
import api from '../../api/axios';

const NAV_ITEMS = [
  { path: '/admin', icon: 'dashboard', label: 'Dashboard', end: true },
  { path: '/admin/degrees', icon: 'degrees', label: 'Degree & Courses' },
  { path: '/admin/trimesters', icon: 'trimesters', label: 'Teaching Period' },
  { path: '/admin/tutors', icon: 'tutors', label: 'Tutors' },
  { path: '/admin/classrooms', icon: 'classrooms', label: 'Classrooms' },
  { path: '/admin/timetable', icon: 'timetable', label: 'Timetable' },
  { path: '/view-only-timetable', icon: 'view', label: 'View-Only Timetable' },
  { path: '/admin/download-timetable', icon: 'download', label: 'Download Timetable' },
  { path: '/admin/calendar', icon: 'calendar', label: 'Academic Calendar' },
];

export default function AdminDashboard() {
  return <DashboardShell navItems={NAV_ITEMS} portalLabel="Admin Panel" />;
}

function StatCard({ label, value, detail, tone = 'blue' }) {
  return (
    <div className={`stat-card stat-card-${tone}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-detail">{detail}</div>
    </div>
  );
}

function MiniBar({ label, value, max, detail }) {
  const width = max > 0 ? Math.max(4, Math.min((value / max) * 100, 100)) : 0;

  return (
    <div className="mini-bar-row">
      <div className="flex items-center justify-between gap-3">
        <span className="truncate font-semibold text-surface-800">{label}</span>
        <span className="text-xs text-surface-500">{detail || value}</span>
      </div>
      <div className="mini-bar-track">
        <div className="mini-bar-fill" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export function AdminHome() {
  const [degrees, setDegrees] = useState([]);
  const [courses, setCourses] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [tutors, setTutors] = useState([]);
  const [trimesters, setTrimesters] = useState([]);
  const [entries, setEntries] = useState([]);
  const [selectedTrimester, setSelectedTrimester] = useState('');
  const [loading, setLoading] = useState(true);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    Promise.all([
      api.get('/degrees'),
      api.get('/courses'),
      api.get('/classrooms'),
      api.get('/tutors'),
      api.get('/trimesters')
    ])
      .then(([degreeRes, courseRes, classroomRes, tutorRes, trimesterRes]) => {
        if (!active) return;

        setDegrees(degreeRes.data);
        setCourses(courseRes.data);
        setClassrooms(classroomRes.data);
        setTutors(tutorRes.data);
        setTrimesters(trimesterRes.data);

        const now = new Date();
        const current = trimesterRes.data.find(t => (
          new Date(t.start_date) <= now && new Date(t.end_date) >= now
        ));
        const initialTrimesterId = (current || trimesterRes.data[0])?.id || '';
        setEntriesLoading(Boolean(initialTrimesterId));
        setSelectedTrimester(initialTrimesterId);
      })
      .catch(() => {
        if (active) setError('Unable to load dashboard data.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedTrimester) {
      return;
    }

    let active = true;
    api.get(`/timetable?trimester_id=${selectedTrimester}`)
      .then(res => {
        if (!active) return;
        setEntries(Array.from(new Map(res.data.map(entry => [entry.id, entry])).values()));
      })
      .catch(() => {
        if (active) setEntries([]);
      })
      .finally(() => {
        if (active) setEntriesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedTrimester]);

  const selectedTrimesterData = trimesters.find(t => String(t.id) === String(selectedTrimester));

  const dashboardData = useMemo(() => {
    const roomCounts = entries.reduce((counts, entry) => {
      const label = entry.room_number || 'TBA';
      counts.set(label, (counts.get(label) || 0) + 1);
      return counts;
    }, new Map());

    const tutorCounts = entries.reduce((counts, entry) => {
      const label = entry.tutor_name || 'Unassigned';
      counts.set(label, (counts.get(label) || 0) + 1);
      return counts;
    }, new Map());

    const roomUtilization = [...roomCounts.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const tutorWorkload = [...tutorCounts.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return { roomUtilization, tutorWorkload };
  }, [entries]);

  const maxRoomCount = Math.max(...dashboardData.roomUtilization.map(item => item.value), 0);
  const maxTutorCount = Math.max(...dashboardData.tutorWorkload.map(item => item.value), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <p className="page-kicker">Live operations</p>
          <h2 className="page-title">Admin Dashboard</h2>
          <p className="page-subtitle">UniSC TimeSync: Timetable Management System dashboard for rooms, tutors, and trimester activity.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/degrees" className="btn btn-secondary btn-sm">Create Degree / Course</Link>
          <Link to="/admin/classrooms" className="btn btn-secondary btn-sm">Add Classroom</Link>
          <Link to="/admin/tutors" className="btn btn-secondary btn-sm">Add Tutor</Link>
          <Link to="/admin/timetable" className="btn btn-primary btn-sm">Open Scheduler</Link>
        </div>
      </div>

      {error && <div className="alert-card alert-error mb-5">{error}</div>}

      <div className="glass-panel p-4 mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_18rem] gap-4 items-end">
          <div>
            <h3 className="section-title">Current Trimester Overview</h3>
            <p className="text-sm text-surface-600 mt-1">
              {selectedTrimesterData
                ? `${selectedTrimesterData.name} runs from ${new Date(selectedTrimesterData.start_date).toLocaleDateString()} to ${new Date(selectedTrimesterData.end_date).toLocaleDateString()}.`
                : 'Choose a teaching period to populate operational metrics.'}
            </p>
          </div>
          <div className="form-group">
            <label className="form-label">Teaching Period</label>
            <select
              className="form-select"
              value={selectedTrimester}
              onChange={e => {
                setSelectedTrimester(e.target.value);
                setEntriesLoading(Boolean(e.target.value));
                if (!e.target.value) setEntries([]);
              }}
            >
              <option value="">Select teaching period...</option>
              {trimesters.map(trimester => (
                <option key={trimester.id} value={trimester.id}>{trimester.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="skeleton-card" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <StatCard label="Degrees" value={degrees.length} detail="Academic programs" />
          <StatCard label="Courses" value={courses.length} detail="Courses available" tone="green" />
          <StatCard label="Classrooms" value={classrooms.length} detail={`${classrooms.filter(room => room.is_available).length} available`} tone="yellow" />
          <StatCard label="Tutors" value={tutors.length} detail="Teaching staff" />
          <StatCard label="Teaching Periods" value={trimesters.length} detail="Periods configured" tone="green" />
          <StatCard label="Total Classes" value={entriesLoading ? '...' : entries.length} detail="Scheduled in selected trimester" tone="yellow" />
          <StatCard label="Room Usage" value={dashboardData.roomUtilization.length} detail="Rooms with bookings" tone="green" />
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="glass-panel p-5">
          <h3 className="section-title mb-4">Room Utilization Summary</h3>
          {dashboardData.roomUtilization.length === 0 ? (
            <div className="empty-state compact">No room usage for selected trimester.</div>
          ) : dashboardData.roomUtilization.map(item => (
            <MiniBar key={item.label} label={item.label} value={item.value} max={maxRoomCount} detail={`${item.value} classes`} />
          ))}
        </div>

        <div className="glass-panel p-5">
          <h3 className="section-title mb-4">Tutor Workload Summary</h3>
          {dashboardData.tutorWorkload.length === 0 ? (
            <div className="empty-state compact">No tutor workload for selected trimester.</div>
          ) : dashboardData.tutorWorkload.map(item => (
            <MiniBar key={item.label} label={item.label} value={item.value} max={maxTutorCount} detail={`${item.value} classes`} />
          ))}
        </div>
      </div>
    </div>
  );
}
