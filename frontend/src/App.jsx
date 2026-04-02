/**
 * TTMS App — Main routing configuration.
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
import UnitManager from './pages/admin/UnitManager';
import TrimesterManager from './pages/admin/TrimesterManager';
import ClassroomManager from './pages/admin/ClassroomManager';
import TutorManager from './pages/admin/TutorManager';
import TimetableManager from './pages/admin/TimetableManager';
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
        <div className="text-primary-400 text-lg font-medium">Loading TTMS...</div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={user ? <Navigate to={user.role === 'admin' ? '/admin' : '/student'} /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to={user.role === 'admin' ? '/admin' : '/student'} /> : <Register />} />

      {/* Admin routes */}
      <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>}>
        <Route index element={<AdminHome />} />
        <Route path="degrees" element={<DegreeManager />} />
        <Route path="units" element={<UnitManager />} />
        <Route path="trimesters" element={<TrimesterManager />} />
        <Route path="classrooms" element={<ClassroomManager />} />
        <Route path="tutors" element={<TutorManager />} />
        <Route path="timetable" element={<TimetableManager />} />
        <Route path="calendar" element={<CalendarManager />} />
      </Route>

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
