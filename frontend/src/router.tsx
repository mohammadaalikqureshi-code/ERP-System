import React, { Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { RouteGuard } from './components/guards/RouteGuard';
import { LoadingSpinner } from './components/shared/LoadingSpinner';
import { useAuthStore } from './stores/authStore';

// Lazy load all pages
const LoginPage = React.lazy(() => import('./pages/auth/LoginPage').then(m => ({ default: m.LoginPage })));
const RegisterClinicPage = React.lazy(() => import('./pages/auth/RegisterClinicPage'));
const PatientReportsPage = React.lazy(() => import('./pages/public/PatientReportsPage'));
const DoctorDashboard = React.lazy(() => import('./pages/doctor/DoctorDashboard'));
const ConsultationView = React.lazy(() => import('./pages/doctor/ConsultationView'));
const SchedulePage = React.lazy(() => import('./pages/doctor/SchedulePage'));
const AdminDashboard = React.lazy(() => import('./pages/admin/AdminDashboard'));
const ClinicsPage = React.lazy(() => import('./pages/admin/ClinicsPage'));
const DoctorsPage = React.lazy(() => import('./pages/admin/DoctorsPage'));
const StaffPage = React.lazy(() => import('./pages/admin/StaffPage'));
const AuditLogsPage = React.lazy(() => import('./pages/admin/AuditLogsPage'));
const BackupPage = React.lazy(() => import('./pages/admin/BackupPage'));
const TokenControlPage = React.lazy(() => import('./pages/admin/TokenControlPage'));
const QueueDisplay = React.lazy(() => import('./pages/public/QueueDisplay'));
const LabDashboard = React.lazy(() => import('./pages/lab/LabDashboard'));
const UnauthorizedPage = React.lazy(() => import('./pages/errors/UnauthorizedPage').then(m => ({ default: m.UnauthorizedPage })));
const NotFoundPage = React.lazy(() => import('./pages/errors/NotFoundPage').then(m => ({ default: m.NotFoundPage })));

const PatientLogin = React.lazy(() => import('./pages/patient/PatientLogin'));
const PatientDashboard = React.lazy(() => import('./pages/patient/PatientDashboard'));

const ReportsPage = React.lazy(() => import('./pages/admin/ReportsPage'));
const PanelsPage = React.lazy(() => import('./pages/admin/PanelsPage'));
const AiConsolePage = React.lazy(() => import('./pages/admin/AiConsolePage'));
const InventoryDashboard = React.lazy(() => import('./pages/inventory/InventoryDashboard'));
const ClinicSettingsPage = React.lazy(() => import('./pages/admin/ClinicSettingsPage'));
const ReceptionDashboard = React.lazy(() => import('./pages/reception/ReceptionDashboard'));
const PatientRegistration = React.lazy(() => import('./pages/reception/PatientRegistration'));
const PatientSearch = React.lazy(() => import('./pages/reception/PatientSearch'));
const AppointmentBooking = React.lazy(() => import('./pages/reception/AppointmentBooking'));
const QueueManagement = React.lazy(() => import('./pages/reception/QueueManagement'));
const BillingPage = React.lazy(() => import('./pages/reception/BillingPage'));

// Helper for Suspense wrap
const withSuspense = (Element: React.ComponentType) => (
  <Suspense fallback={
    <div className="flex h-full items-center justify-center p-8">
      <LoadingSpinner size="lg" />
    </div>
  }>
    <Element />
  </Suspense>
);

// Role redirect component
const RoleRedirect = () => {
  const user = useAuthStore(state => state.user);
  
  if (!user) return <Navigate to="/login" replace />;
  
  switch (user.role) {
    case 'super_admin':
    case 'clinic_admin':
      return <Navigate to="/admin" replace />;
    case 'doctor':
      return <Navigate to="/doctor" replace />;
    case 'receptionist':
    case 'nurse':
      return <Navigate to="/reception" replace />;
    case 'lab_staff':
      return <Navigate to="/lab" replace />;
    case 'pharmacist':
      return <Navigate to="/inventory" replace />;
    case 'patient':
      return <Navigate to="/patient/dashboard" replace />;
    default:
      return <Navigate to="/unauthorized" replace />;
  }
};

export const router = createBrowserRouter([
  {
    path: '/login',
    element: withSuspense(LoginPage)
  },
  {
    path: '/register',
    element: withSuspense(RegisterClinicPage)
  },
  {
    path: '/onboard',
    element: withSuspense(RegisterClinicPage)
  },
  {
    path: '/reports',
    element: withSuspense(PatientReportsPage)
  },
  {
    path: '/patient-reports',
    element: withSuspense(PatientReportsPage)
  },
  {
    path: '/patient/login',
    element: withSuspense(PatientLogin)
  },
  {
    path: '/queue',
    element: withSuspense(QueueDisplay)
  },
  {
    // The waiting-room TV is usually bookmarked at this longer path.
    path: '/queue/display',
    element: withSuspense(QueueDisplay)
  },
  {
    path: '/unauthorized',
    element: withSuspense(UnauthorizedPage)
  },
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <RoleRedirect />
      },
      // Admin Routes
      {
        path: 'admin',
        element: <RouteGuard allowedRoles={['super_admin', 'clinic_admin']} />,
        children: [
          { index: true, element: withSuspense(AdminDashboard) },
          { path: 'clinics', element: withSuspense(ClinicsPage) },
          { path: 'tokens', element: withSuspense(TokenControlPage) },
          { path: 'doctors', element: withSuspense(DoctorsPage) },
          { path: 'staff', element: withSuspense(StaffPage) },
          { path: 'audit', element: withSuspense(AuditLogsPage) },
          { path: 'backup', element: withSuspense(BackupPage) },
          { path: 'reports', element: withSuspense(ReportsPage) },
          { path: 'ai', element: withSuspense(AiConsolePage) },
          { path: 'panels', element: withSuspense(PanelsPage) },
          { path: 'settings', element: withSuspense(ClinicSettingsPage) },
        ]
      },
      // Doctor Routes
      {
        path: 'doctor',
        element: <RouteGuard allowedRoles={['doctor', 'super_admin', 'clinic_admin', 'nurse', 'receptionist']} />,
        children: [
          { index: true, element: withSuspense(DoctorDashboard) },
          { path: 'consultation/:appointmentId', element: withSuspense(ConsultationView) },
          { path: 'schedule', element: withSuspense(SchedulePage) },
        ]
      },
      // Reception Routes
      {
        path: 'reception',
        element: <RouteGuard allowedRoles={['receptionist', 'nurse', 'doctor', 'clinic_admin', 'super_admin']} />,
        children: [
          { index: true, element: withSuspense(ReceptionDashboard) },
          { path: 'patients', element: withSuspense(PatientRegistration) },
          { path: 'patients/search', element: withSuspense(PatientSearch) },
          { path: 'appointments', element: withSuspense(AppointmentBooking) },
          { path: 'queue', element: withSuspense(QueueManagement) },
          { path: 'billing', element: withSuspense(BillingPage) },
        ]
      },
      // Inventory / Pharmacy Routes
      {
        path: 'inventory',
        element: <RouteGuard allowedRoles={['pharmacist', 'doctor', 'nurse', 'receptionist', 'clinic_admin', 'super_admin']} />,
        children: [
          { index: true, element: withSuspense(InventoryDashboard) },
        ]
      },
      // Lab Routes
      {
        path: 'lab',
        element: <RouteGuard allowedRoles={['lab_staff', 'doctor', 'nurse', 'receptionist', 'clinic_admin', 'super_admin']} />,
        children: [
          { index: true, element: withSuspense(LabDashboard) },
        ]
      },
      // Patient Routes
      {
        path: 'patient',
        element: <RouteGuard allowedRoles={['patient', 'receptionist', 'nurse', 'doctor', 'clinic_admin', 'super_admin']} />,
        children: [
          { path: 'dashboard', element: withSuspense(PatientDashboard) },
        ]
      }
    ]
  },
  {
    path: '*',
    element: withSuspense(NotFoundPage)
  }
]);
