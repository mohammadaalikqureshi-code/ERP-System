import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import api from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, FileText, LogOut } from 'lucide-react';
import { API_BASE_URL } from '@/lib/constants';

import { StatusBadge } from '@/components/shared/StatusBadge';

type DashboardData = {
  patient_id: string;
  patientCode: string;
  fullName: string;
  mobile: string;
  upcomingAppointments: any[];
  recentPrescriptions: any[];
};

export default function PatientDashboard() {
  const { logout } = useAuthStore();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await api.get('/patient-portal/dashboard');
        setData(response.data);
      } catch (error) {
        console.error("Failed to load dashboard", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/patient/login');
  };

  if (isLoading) {
    return <div className="p-8 text-center">Loading your dashboard...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex justify-between items-center bg-teal-700 text-white p-6 rounded-lg shadow-md">
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {data?.fullName}</h1>
          <p className="opacity-90">Patient ID: {data?.patientCode}</p>
        </div>
        <Button variant="secondary" onClick={handleLogout} className="shrink-0">
          <LogOut className="mr-2 h-4 w-4" /> Sign Out
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-medium">Upcoming Appointments</CardTitle>
            <Calendar className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {data?.upcomingAppointments && data.upcomingAppointments.length > 0 ? (
              <div className="space-y-4 mt-4">
                {data.upcomingAppointments.map((appt) => (
                  <div key={appt.id} className="flex items-center justify-between p-4 border rounded-lg bg-stone-50 dark:bg-stone-900/50">
                    <div className="flex flex-col">
                      <span className="font-semibold">{new Date(appt.date).toLocaleDateString()} at {appt.time}</span>
                      <span className="text-sm text-muted-foreground mt-1">Status: <StatusBadge status={appt.status} /></span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg mt-4">
                No upcoming appointments.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-medium">Recent Prescriptions</CardTitle>
            <FileText className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {data?.recentPrescriptions && data.recentPrescriptions.length > 0 ? (
              <div className="space-y-4 mt-4">
                {data.recentPrescriptions.map((presc) => (
                  <div key={presc.id} className="p-4 border rounded-lg bg-stone-50 dark:bg-stone-900/50 flex justify-between items-center">
                    <div>
                      <div className="font-medium">Prescribed on {new Date(presc.date).toLocaleDateString()}</div>
                      <div className="text-sm text-muted-foreground truncate max-w-[200px] mt-1">{presc.notes || "No notes"}</div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => window.open(`${API_BASE_URL}/emr/prescriptions/${presc.id}/pdf`, '_blank')}>
                      View PDF
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg mt-4">
                No recent prescriptions.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
