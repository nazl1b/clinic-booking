import { createBrowserRouter, createRoutesFromElements, Navigate, Route, RouterProvider } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { AuthLayout } from './components/layout/AuthLayout';
import { GuestOnly, RequireRole } from './components/RequireRole';
import { ButtonLink } from './components/ui/Button';
import { Card } from './components/ui/Card';
import { Muted } from './components/ui/PageHeader';
import { ConfirmProvider } from './components/ui/ConfirmDialog';
import { ToastProvider } from './components/ui/ToastProvider';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import AcceptInvite from './pages/AcceptInvite';
import AdminAppointments from './pages/AdminAppointments';
import AdminDoctors from './pages/AdminDoctors';
import Availability from './pages/Availability';
import BookSlot from './pages/BookSlot';
import DoctorAppointments from './pages/DoctorAppointments';
import DoctorProfile from './pages/DoctorProfile';
import DoctorSchedule from './pages/DoctorSchedule';
import Doctors from './pages/Doctors';
import InviteDoctor from './pages/InviteDoctor';
import ForgotPassword from './pages/ForgotPassword';
import Login from './pages/Login';
import MyAppointments from './pages/MyAppointments';
import NewStaffAppointment from './pages/NewStaffAppointment';
import Profile from './pages/Profile';
import Register from './pages/Register';
import ResetPassword from './pages/ResetPassword';
import { homePathFor } from './utils/roles';

// "/" sends each user to the home page of their role.
function Home() {
  const { user } = useAuth();
  return user ? <Navigate to={homePathFor(user.role)} replace /> : null;
}

// Unknown URLs keep the user's layout: sidebar when logged in, auth layout otherwise.
function NotFoundLayout() {
  const { user, loading } = useAuth();
  if (loading) return <Muted>Loading…</Muted>;
  return user ? <AppLayout /> : <AuthLayout />;
}

function NotFound() {
  return (
    <Card title="Page not found" titleLevel={1}>
      <Muted>The page you are looking for does not exist.</Muted>
      <div>
        <ButtonLink to="/" variant="secondary">
          Go to the home page
        </ButtonLink>
      </div>
    </Card>
  );
}

// A data router (not <BrowserRouter>), so pages can block leaving with unsaved
// changes (useBlocker, e.g. Working hours).
const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      {/* Pages without sidebar (404 is at the end) */}
      <Route element={<AuthLayout />}>
        <Route path="login" element={<GuestOnly><Login /></GuestOnly>} />
        <Route path="register" element={<GuestOnly><Register /></GuestOnly>} />
        <Route path="forgot-password" element={<GuestOnly><ForgotPassword /></GuestOnly>} />
        <Route path="reset-password" element={<GuestOnly><ResetPassword /></GuestOnly>} />
        {/* Not GuestOnly: a logged-in user is asked to log out first */}
        <Route path="accept-invite" element={<AcceptInvite />} />
      </Route>

      {/* Logged-in pages: sidebar + top bar */}
      <Route element={<RequireRole><AppLayout /></RequireRole>}>
        <Route index element={<Home />} />
        <Route path="profile" element={<Profile />} />

        {/* Patient */}
        <Route path="doctors" element={<RequireRole roles={['patient']}><Doctors /></RequireRole>} />
        <Route path="doctors/:id" element={<RequireRole roles={['patient', 'admin']}><DoctorProfile /></RequireRole>} />
        <Route path="doctors/:id/book" element={<RequireRole roles={['patient']}><BookSlot /></RequireRole>} />
        <Route path="appointments" element={<RequireRole roles={['patient']}><MyAppointments /></RequireRole>} />

        {/* Doctor */}
        <Route path="doctor/schedule" element={<RequireRole roles={['doctor']}><DoctorSchedule /></RequireRole>} />
        <Route path="doctor/schedule/new" element={<RequireRole roles={['doctor']}><NewStaffAppointment /></RequireRole>} />
        <Route path="doctor/appointments" element={<RequireRole roles={['doctor']}><DoctorAppointments /></RequireRole>} />
        <Route path="doctor/availability" element={<RequireRole roles={['doctor']}><Availability /></RequireRole>} />

        {/* Admin */}
        <Route path="admin/doctors" element={<RequireRole roles={['admin']}><AdminDoctors /></RequireRole>} />
        <Route path="admin/doctors/invite" element={<RequireRole roles={['admin']}><InviteDoctor /></RequireRole>} />
        <Route path="admin/appointments" element={<RequireRole roles={['admin']}><AdminAppointments /></RequireRole>} />
        <Route path="admin/appointments/new" element={<RequireRole roles={['admin']}><NewStaffAppointment /></RequireRole>} />
      </Route>

      <Route element={<NotFoundLayout />}>
        <Route path="*" element={<NotFound />} />
      </Route>
    </>,
  ),
);

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <ConfirmProvider>
          <RouterProvider router={router} />
        </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
