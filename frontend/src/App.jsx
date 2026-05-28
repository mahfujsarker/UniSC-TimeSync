/**
 * UniSC TimeSync App — Main routing configuration.
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Auth pages
import Login from './pages/Login';
import Register from './pages/Register';

// Admin pages
import AdminDashboard, { AdminHome } from './pages/admin/AdminDashboard';
import DegreeManager from './pages/admin/DegreeManager';
import TrimesterManager from './pages/admin/TrimesterManager';
import ClassroomManager from './pages/admin/ClassroomManager';
import TutorManager from './pages/admin/TutorManager';
import TimetableManager from './pages/admin/TimetableManager';
import RoutineTimetable from './pages/admin/RoutineTimetable';
import DownloadTimetable from './pages/admin/DownloadTimetable';
import ViewOnlyTimetable from './pages/admin/ViewOnlyTimetable';
import CalendarManager from './pages/admin/CalendarManager';

// Student pages
import StudentDashboard, { StudentHome } from './pages/student/StudentDashboard';
import ViewTimetable from './pages/student/ViewTimetable';
import SelectClasses from './pages/student/SelectClasses';
import MyClasses from './pages/student/MyClasses';

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-primary-400 text-lg font-medium">Loading UniSC TimeSync...</div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={user ? <Navigate to={user.role === 'admin' ? '/admin' : '/student'} /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to={user.role === 'admin' ? '/admin' : '/student'} /> : <Register />} />
      <Route path="/view-only-timetable" element={<ViewOnlyTimetable publicMode />} />

      {/* Admin routes */}
      <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>}>
        <Route index element={<AdminHome />} />
        <Route path="degrees" element={<DegreeManager />} />
        <Route path="courses" element={<Navigate to="/admin/degrees" replace />} />
        <Route path="units" element={<Navigate to="/admin/degrees" replace />} />
        <Route path="trimesters" element={<TrimesterManager />} />
        <Route path="classrooms" element={<ClassroomManager />} />
        <Route path="tutors" element={<TutorManager />} />
        <Route path="timetable" element={<TimetableManager />} />
        <Route path="timetable/routine/:trimesterId" element={<RoutineTimetable />} />
        <Route path="download-timetable" element={<DownloadTimetable />} />
        <Route path="calendar" element={<CalendarManager />} />
      </Route>

      <Route
        path="/download-timetable"
        element={<ProtectedRoute requiredRole="admin"><Navigate to="/admin/download-timetable" replace /></ProtectedRoute>}
      />
      <Route
        path="/timetable/routine/:trimesterId"
        element={<ProtectedRoute requiredRole="admin"><RoutineTimetable /></ProtectedRoute>}
      />

      {/* Student routes */}
      <Route path="/student" element={<ProtectedRoute requiredRole="student"><StudentDashboard /></ProtectedRoute>}>
        <Route index element={<StudentHome />} />
        <Route path="timetable" element={<ViewTimetable />} />
        <Route path="select-classes" element={<SelectClasses />} />
        <Route path="my-classes" element={<MyClasses />} />
      </Route>

      {/* Default redirect */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
