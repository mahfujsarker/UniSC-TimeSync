/**
 * Student Dashboard - Main layout with responsive navigation.
 */
import { Link } from 'react-router-dom';
import DashboardShell from '../../components/DashboardShell';

const NAV_ITEMS = [
  { path: '/student', icon: 'dashboard', label: 'Dashboard', end: true },
  { path: '/student/timetable', icon: 'view', label: 'View-Only Timetable' },
  { path: '/student/select-classes', icon: 'degrees', label: 'Select Classes' },
  { path: '/student/my-classes', icon: 'courses', label: 'My Classes' },
];

export default function StudentDashboard() {
  return <DashboardShell navItems={NAV_ITEMS} portalLabel="Student Portal" accent="yellow" />;
}

export function StudentHome() {
  const actions = [
    { label: 'View Timetable', path: '/student/timetable', desc: 'See the published timetable for your degree.', tone: 'blue' },
    { label: 'Select Classes', path: '/student/select-classes', desc: 'Enroll in available classes and time slots.', tone: 'yellow' },
    { label: 'My Classes', path: '/student/my-classes', desc: 'Review your enrolled classes and weekly schedule.', tone: 'green' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <p className="page-kicker">Student workspace</p>
          <h2 className="page-title">Student Dashboard</h2>
          <p className="page-subtitle">Use UniSC TimeSync to find your timetable, select classes, and keep your weekly schedule clear.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {actions.map(item => (
          <Link
            to={item.path}
            key={item.label}
            className={`action-card action-card-${item.tone}`}
          >
            <div className="action-orb">{item.label.split(' ').map(word => word[0]).join('').slice(0, 2)}</div>
            <h3>{item.label}</h3>
            <p>{item.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
