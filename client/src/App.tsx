import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { AuthLayout } from './components/layout/AuthLayout';
import { RootLayout } from './components/layout/RootLayout';
import { GuestOnly, RequireRole } from './components/RequireRole';
import { ButtonLink } from './components/ui/Button';
import { Card } from './components/ui/Card';
import { Muted } from './components/ui/PageHeader';
import { AuthProvider, homePathFor, useAuth } from './context/AuthContext';
import AcceptInvite from './pages/AcceptInvite';
import AdminAppointments from './pages/AdminAppointments';
import AdminDoctors from './pages/AdminDoctors';
import Availability from './pages/Availability';
import BookSlot from './pages/BookSlot';
import DoctorAppointments from './pages/DoctorAppointments';
import DoctorSchedule from './pages/DoctorSchedule';
import Doctors from './pages/Doctors';
import ForgotPassword from './pages/ForgotPassword';
import Login from './pages/Login';
import MyAppointments from './pages/MyAppointments';
import Profile from './pages/Profile';
import Register from './pages/Register';
import ResetPassword from './pages/ResetPassword';

// "/" sends each user to the home page of their role.
function Home() {
  const { user } = useAuth();
  return user ? <Navigate to={homePathFor(user.role)} replace /> : null;
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

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<RootLayout />}>
            {/* Pages without sidebar */}
            <Route element={<AuthLayout />}>
              <Route path="login" element={<GuestOnly><Login /></GuestOnly>} />
              <Route path="register" element={<GuestOnly><Register /></GuestOnly>} />
              <Route path="forgot-password" element={<ForgotPassword />} />
              <Route path="reset-password" element={<ResetPassword />} />
              <Route path="accept-invite" element={<AcceptInvite />} />
              <Route path="*" element={<NotFound />} />
            </Route>

            {/* Logged-in pages: sidebar + top bar */}
            <Route element={<RequireRole><AppLayout /></RequireRole>}>
              <Route index element={<Home />} />
              <Route path="profile" element={<Profile />} />

              {/* Patient */}
              <Route path="doctors" element={<RequireRole roles={['patient']}><Doctors /></RequireRole>} />
              <Route path="doctors/:id/book" element={<RequireRole roles={['patient']}><BookSlot /></RequireRole>} />
              <Route path="appointments" element={<RequireRole roles={['patient']}><MyAppointments /></RequireRole>} />

              {/* Doctor */}
              <Route path="doctor/schedule" element={<RequireRole roles={['doctor']}><DoctorSchedule /></RequireRole>} />
              <Route path="doctor/appointments" element={<RequireRole roles={['doctor']}><DoctorAppointments /></RequireRole>} />
              <Route path="doctor/availability" element={<RequireRole roles={['doctor']}><Availability /></RequireRole>} />

              {/* Admin */}
              <Route path="admin/doctors" element={<RequireRole roles={['admin']}><AdminDoctors /></RequireRole>} />
              <Route path="admin/appointments" element={<RequireRole roles={['admin']}><AdminAppointments /></RequireRole>} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
