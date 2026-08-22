
import { useReceptionDashboard } from '@/api/dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { Users, CreditCard, Calendar as CalendarIcon, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ReceptionDashboardContent = () => {
  const { data: dashboardData, isLoading, error } = useReceptionDashboard();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !dashboardData) {
    return <div>Failed to load dashboard data.</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Reception Dashboard</h1>
        <div className="flex gap-4">
          <Button onClick={() => navigate('/reception/patients')}>
            Register Patient
          </Button>
          <Button onClick={() => navigate('/reception/appointments')} variant="secondary">
            Book Appointment
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Patients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.totalPatients}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue Today</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{dashboardData.revenue.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Queue Size</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.appointments.checkedIn}</div>
            <p className="text-xs text-muted-foreground">Patients currently waiting</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Appointments</CardTitle>
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.appointments.booked + dashboardData.appointments.checkedIn + dashboardData.appointments.completed}</div>
            <div className="flex text-xs text-muted-foreground gap-2 mt-1">
              <span className="text-green-600 font-medium">{dashboardData.appointments.completed} Done</span>
              <span className="text-red-500 font-medium">{dashboardData.appointments.cancelled} Cancelled</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Appointments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dashboardData.recentAppointments.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">No recent appointments found.</div>
              ) : (
                dashboardData.recentAppointments.map(appointment => (
                  <div key={appointment.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                    <div>
                      <p className="text-sm font-medium leading-none">{appointment.patient?.firstName} {appointment.patient?.lastName}</p>
                      <p className="text-sm text-muted-foreground">{appointment.appointmentTime} - {appointment.doctor?.firstName} {appointment.doctor?.lastName}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-sm font-bold bg-muted px-2 py-1 rounded">{appointment.tokenNumber}</div>
                      <StatusBadge status={appointment.status} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
             <Button onClick={() => navigate('/reception/queue')} className="w-full justify-start" variant="outline">
                <Activity className="mr-2 h-4 w-4" /> Go to Live Queue
             </Button>
             <Button onClick={() => navigate('/reception/billing')} className="w-full justify-start" variant="outline">
                <CreditCard className="mr-2 h-4 w-4" /> Process Billing
             </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default function ReceptionDashboard() {
  return (
    <ErrorBoundary>
      <ReceptionDashboardContent />
    </ErrorBoundary>
  );
}
