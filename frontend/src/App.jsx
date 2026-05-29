/**
 * UniSC TimeSync App - Main routing configuration.
 */
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Auth pages stay in the initial bundle because they are the default entry flow.
import Login from './pages/Login';
import Register from './pages/Register';

const adminDashboardModule = () => import('./pages/admin/AdminDashboard');
const AdminDashboard = lazy(adminDashboardModule);
const AdminHome = lazy(() => adminDashboardModule().then(module => ({ default: module.AdminHome })));
const DegreeManager = lazy(() => import('./pages/admin/DegreeManager'));
const TrimesterManager = lazy(() => import('./pages/admin/TrimesterManager'));
const ClassroomManager = lazy(() => import('./pages/admin/ClassroomManager'));
const TutorManager = lazy(() => import('./pages/admin/TutorManager'));
const TimetableManager = lazy(() => import('./pages/admin/TimetableManager'));
const RoutineTimetable = lazy(() => import('./pages/admin/RoutineTimetable'));
const DownloadTimetable = lazy(() => import('./pages/admin/DownloadTimetable'));
const ViewOnlyTimetable = lazy(() => import('./pages/admin/ViewOnlyTimetable'));
const CalendarManager = lazy(() => import('./pages/admin/CalendarManager'));

const studentDashboardModule = () => import('./pages/student/StudentDashboard');
const StudentDashboard = lazy(studentDashboardModule);
const StudentHome = lazy(() => studentDashboardModule().then(module => ({ default: module.StudentHome })));
const ViewTimetable = lazy(() => import('./pages/student/ViewTimetable'));
const SelectClasses = lazy(() => import('./pages/student/SelectClasses'));
const MyClasses = lazy(() => import('./pages/student/MyClasses'));

function LoadingScreen({ label = 'Loading UniSC TimeSync...' }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-primary-400 text-lg font-medium">{label}</div>
    </div>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Suspense fallback={<LoadingScreen label="Loading page..." />}>
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
    </Suspense>
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
