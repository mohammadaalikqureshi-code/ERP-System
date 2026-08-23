import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Clock,
  IndianRupee,
  Users,
  Stethoscope,
  Play,
  FileText,
  UserCheck,
  ChevronRight,
  Sparkles,
  AlertCircle,
  Calendar,
  Phone,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useToast } from '@/components/ui/use-toast';
import { useAuthStore } from '@/stores/authStore';
import { useDoctorTodayAppointments, useStartNextConsultation, useUpdateAppointmentStatus } from '@/api/appointments';
import { useWebSocket } from '@/hooks/useWebSocket';
import api from '@/api/client';
import { Appointment } from '@/types';
import { cn } from '@/lib/utils';

export default function DoctorDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuthStore();
  const [filterTab, setFilterTab] = useState<'all' | 'waiting' | 'completed'>('all');

  // Queries
  const { data: dashboard, isLoading: isLoadingDashboard } = useQuery({
    queryKey: ['doctorDashboard'],
    queryFn: () => api.get('/dashboard/doctor').then(res => res.data),
    refetchInterval: 15000,
  });

  const { data: todayAppointments = [], isLoading: isLoadingAppointments, refetch: refetchAppts } = useDoctorTodayAppointments();
  const { mutate: startNext, isPending: isStartingNext } = useStartNextConsultation();
  const { mutate: updateStatus } = useUpdateAppointmentStatus();

  // Listen to live WebSocket events
  useWebSocket({
    url: '/ws/queue',
    onMessage: (event) => {
      if (['APPOINTMENT_CREATED', 'APPOINTMENT_STATUS_CHANGED', 'QUEUE_UPDATED'].includes(event.type)) {
        refetchAppts();
      }
    },
  });

  const activeConsultation = todayAppointments.find(
    (a) => a.status === 'in_consultation' || a.status === 'IN_CONSULTATION'
  );

  const waitingAppointments = todayAppointments.filter(
    (a) => a.status === 'checked_in' || a.status === 'booked' || a.status === 'scheduled'
  );

  const completedAppointments = todayAppointments.filter(
    (a) => a.status === 'completed' || a.status === 'COMPLETED'
  );

  const filteredAppointments = todayAppointments.filter((a) => {
    if (filterTab === 'waiting') {
      return a.status === 'checked_in' || a.status === 'booked' || a.status === 'in_consultation';
    }
    if (filterTab === 'completed') {
      return a.status === 'completed';
    }
    return true;
  });

  const handleStartNextConsultation = () => {
    // 1. If consultation is already active, jump right in
    if (activeConsultation) {
      toast({
        title: 'Active Consultation In Progress',
        description: `Resuming consultation for Token ${activeConsultation.tokenNumber} (${activeConsultation.patient?.firstName || 'Patient'}).`,
      });
      navigate(`/doctor/consultation/${activeConsultation.id}`);
      return;
    }

    // 2. Call next patient via API
    startNext(undefined, {
      onSuccess: (appointment: Appointment) => {
        toast({
          title: '🩺 Consultation Initiated',
          description: `Called Token ${appointment.tokenNumber} (${appointment.patient?.firstName || 'Patient'}) into Consultation Room.`,
        });
        navigate(`/doctor/consultation/${appointment.id}`);
      },
      onError: (err: any) => {
        toast({
          title: 'Queue Notice',
          description: err.message || 'No patients currently waiting in queue.',
          variant: 'default',
        });
      },
    });
  };

  const handleStartSpecificPatient = (appointment: Appointment) => {
    if (appointment.status === 'in_consultation') {
      navigate(`/doctor/consultation/${appointment.id}`);
      return;
    }

    updateStatus(
      { id: appointment.id, status: 'in_consultation' },
      {
        onSuccess: () => {
          toast({
            title: 'Consultation Started',
            description: `Calling Token ${appointment.tokenNumber} into consultation.`,
          });
          navigate(`/doctor/consultation/${appointment.id}`);
        },
        onError: (err: any) => {
          toast({
            title: 'Action Error',
            description: err.message || 'Failed to start consultation',
            variant: 'destructive',
          });
        },
      }
    );
  };

  const totalAppointments = Object.values(dashboard?.todayAppointments || {}).reduce(
    (a, b) => (a as number) + (b as number),
    0
  );
  const completed = dashboard?.todayAppointments?.completed || completedAppointments.length || 0;
  const pending =
    (dashboard?.todayAppointments?.booked || 0) +
    (dashboard?.todayAppointments?.checkedIn || 0) ||
    waitingAppointments.length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-stone-950 p-6 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-stone-900 dark:text-white tracking-tight">
              Doctor OPD Console
            </h1>
            <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/50 dark:text-teal-400">
              Live Queue
            </Badge>
          </div>
          <p className="text-sm text-stone-500 mt-1">
            Welcome back, <strong className="text-stone-800 dark:text-stone-200">{user?.fullName || 'Doctor'}</strong>. Manage your OPD queue and consultations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleStartNextConsultation}
            disabled={isStartingNext}
            size="lg"
            className="bg-teal-600 hover:bg-teal-700 text-white font-semibold shadow-md shadow-teal-600/20 gap-2 h-11 px-5"
          >
            <Stethoscope className="w-5 h-5 animate-pulse" />
            {activeConsultation
              ? `Resume Consultation (${activeConsultation.tokenNumber})`
              : isStartingNext
              ? 'Calling Next Patient...'
              : 'Start Next Consultation'}
          </Button>
        </div>
      </div>

      {/* Active Consultation Banner if in progress */}
      {activeConsultation && (
        <div className="relative overflow-hidden bg-gradient-to-r from-teal-600 to-emerald-700 text-white p-5 rounded-2xl shadow-lg animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center flex-shrink-0">
                <Stethoscope className="w-7 h-7 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase font-bold tracking-wider bg-white/20 px-2 py-0.5 rounded-full">
                    Active Patient in Room
                  </span>
                  <span className="text-xs text-teal-100 font-mono">Token #{activeConsultation.tokenNumber}</span>
                </div>
                <h3 className="text-xl font-bold mt-1">
                  {activeConsultation.patient?.firstName || 'Patient'} {activeConsultation.patient?.lastName || ''}
                </h3>
                <p className="text-xs text-teal-100 mt-0.5">
                  Scheduled: {activeConsultation.appointmentTime} • Visit: {activeConsultation.visitType || 'General Consultation'}
                </p>
              </div>
            </div>

            <Button
              onClick={() => navigate(`/doctor/consultation/${activeConsultation.id}`)}
              className="bg-white text-teal-800 hover:bg-teal-50 font-bold gap-1.5 shadow-md self-end sm:self-auto"
            >
              <span>Open Consultation Chart</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-stone-200 dark:border-stone-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-stone-600 dark:text-stone-400">Today's Appointments</CardTitle>
            <Users className="h-4 w-4 text-teal-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-stone-900 dark:text-white">
              {isLoadingDashboard ? '-' : String(totalAppointments || todayAppointments.length)}
            </div>
            <p className="text-xs text-stone-500 mt-1">
              <span className="font-semibold text-emerald-600">{completed} completed</span> • {pending} waiting
            </p>
          </CardContent>
        </Card>

        <Card className="border-stone-200 dark:border-stone-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-stone-600 dark:text-stone-400">Avg Consultation Time</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-stone-900 dark:text-white">
              {dashboard?.avgConsultationTime || 12} min
            </div>
            <p className="text-xs text-stone-500 mt-1">Target: ~15 mins / visit</p>
          </CardContent>
        </Card>

        <Card className="border-stone-200 dark:border-stone-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-stone-600 dark:text-stone-400">Today's OPD Revenue</CardTitle>
            <IndianRupee className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-stone-900 dark:text-white">
              ₹{(dashboard?.todayEarnings || (completed * 800)).toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-stone-500 mt-1">Consultation receipts settled</p>
          </CardContent>
        </Card>

        <Card className="border-stone-200 dark:border-stone-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-stone-600 dark:text-stone-400">Waiting in Lobby</CardTitle>
            <UserCheck className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-purple-600 dark:text-purple-400">
              {waitingAppointments.length}
            </div>
            <p className="text-xs text-stone-500 mt-1">Ready for consultation</p>
          </CardContent>
        </Card>
      </div>

      {/* Patient Queue & Schedule */}
      <Card className="border-stone-200 dark:border-stone-800 overflow-hidden shadow-sm">
        <CardHeader className="border-b border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/40 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-bold text-stone-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-teal-600" />
                Today's Patient Consultation Queue
              </CardTitle>
              <CardDescription>
                Live list of scheduled, checked-in, and completed visits for today.
              </CardDescription>
            </div>

            <Tabs value={filterTab} onValueChange={(v) => setFilterTab(v as any)}>
              <TabsList className="bg-stone-200/70 dark:bg-stone-800 p-0.5">
                <TabsTrigger value="all" className="text-xs">
                  All ({todayAppointments.length})
                </TabsTrigger>
                <TabsTrigger value="waiting" className="text-xs">
                  Waiting ({waitingAppointments.length + (activeConsultation ? 1 : 0)})
                </TabsTrigger>
                <TabsTrigger value="completed" className="text-xs">
                  Completed ({completedAppointments.length})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoadingAppointments ? (
            <div className="p-12 text-center text-stone-500">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mb-3" />
              <p>Loading patient queue...</p>
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className="py-16 text-center text-stone-500">
              <Sparkles className="w-10 h-10 text-stone-300 dark:text-stone-700 mx-auto mb-3" />
              <p className="text-base font-semibold text-stone-800 dark:text-stone-200">
                {filterTab === 'waiting'
                  ? 'No patients waiting in queue'
                  : filterTab === 'completed'
                  ? 'No completed consultations yet'
                  : 'No appointments scheduled for today'}
              </p>
              <p className="text-xs text-stone-400 mt-1">
                Patients will automatically appear here as front desk checks them in.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-stone-100 dark:divide-stone-800">
              {filteredAppointments.map((apt) => {
                const isActive = apt.status === 'in_consultation' || apt.status === 'IN_CONSULTATION';
                const isCheckedIn = apt.status === 'checked_in' || apt.status === 'CHECKED_IN';
                const isCompleted = apt.status === 'completed' || apt.status === 'COMPLETED';

                return (
                  <div
                    key={apt.id}
                    className={cn(
                      'p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors',
                      isActive
                        ? 'bg-teal-50/40 dark:bg-teal-950/30 border-l-4 border-l-teal-600'
                        : 'hover:bg-stone-50/80 dark:hover:bg-stone-900/40'
                    )}
                  >
                    {/* Patient Details */}
                    <div className="flex items-start sm:items-center gap-3.5">
                      <div className="flex flex-col items-center justify-center w-14 h-14 rounded-xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 flex-shrink-0">
                        <span className="text-[10px] font-bold text-stone-400 uppercase">Token</span>
                        <span className="text-base font-black text-teal-700 dark:text-teal-400">
                          {apt.tokenNumber || `#${apt.queueNumber}`}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-stone-900 dark:text-white text-base">
                            {apt.patient?.firstName || 'Patient'} {apt.patient?.lastName || ''}
                          </h4>
                          <StatusBadge status={apt.status} />
                          {apt.visitType && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {apt.visitType}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-stone-500 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-stone-400" />
                            {apt.appointmentTime}
                          </span>
                          {apt.patient?.gender && (
                            <span>• {apt.patient.gender}</span>
                          )}
                          {apt.patient?.mobile && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-stone-400" />
                              {apt.patient.mobile}
                            </span>
                          )}
                          {apt.notes && (
                            <span className="italic text-stone-400 max-w-xs truncate">
                              "{apt.notes}"
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
                      {isActive ? (
                        <Button
                          onClick={() => navigate(`/doctor/consultation/${apt.id}`)}
                          className="bg-teal-600 hover:bg-teal-700 text-white font-semibold gap-1.5 shadow-sm"
                          size="sm"
                        >
                          <Stethoscope className="w-4 h-4" />
                          <span>Resume Consultation</span>
                        </Button>
                      ) : isCompleted ? (
                        <Button
                          variant="outline"
                          onClick={() => navigate(`/doctor/consultation/${apt.id}`)}
                          className="text-stone-700 dark:text-stone-300 hover:bg-stone-100 gap-1.5"
                          size="sm"
                        >
                          <FileText className="w-4 h-4" />
                          <span>View EMR / Rx</span>
                        </Button>
                      ) : (
                        <Button
                          onClick={() => handleStartSpecificPatient(apt)}
                          className={cn(
                            'font-semibold gap-1.5 shadow-sm',
                            isCheckedIn
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : 'bg-stone-800 hover:bg-stone-900 text-white dark:bg-stone-200 dark:text-stone-900'
                          )}
                          size="sm"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>{isCheckedIn ? 'Call Patient' : 'Start Consultation'}</span>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

