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
  AlertTriangle,
  Zap,
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
    refetchInterval: 10000,
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

  const emergencyWaiting = todayAppointments.find(
    (a) => (a.visitType === 'emergency' || a.tokenNumber?.startsWith('EMG')) && 
           (a.status === 'checked_in' || a.status === 'CHECKED_IN')
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

    // 2. Call next patient via API (prioritizes Emergency)
    startNext(undefined, {
      onSuccess: (appointment: Appointment) => {
        toast({
          title: '🩺 Consultation Initiated',
          description: `Called Token ${appointment.tokenNumber} (${appointment.patient?.firstName || 'Patient'}) into Consultation Room.`,
          variant: (appointment.visitType === 'emergency' || appointment.tokenNumber?.startsWith('EMG')) ? 'destructive' : 'success',
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
    updateStatus(
      { id: appointment.id, status: 'in_consultation' },
      {
        onSuccess: () => {
          toast({
            title: 'Consultation Room Started',
            description: `Calling Token #${appointment.tokenNumber} (${appointment.patient?.firstName || 'Patient'}).`,
            variant: (appointment.visitType === 'emergency' || appointment.tokenNumber?.startsWith('EMG')) ? 'destructive' : 'success',
          });
          navigate(`/doctor/consultation/${appointment.id}`);
        },
        onError: (err: any) => {
          toast({
            title: 'Action Failed',
            description: err.response?.data?.message || 'Failed to start consultation.',
            variant: 'destructive',
          });
        },
      }
    );
  };

  const totalAppointments = dashboard?.todayAppointments || todayAppointments.length;
  const completed = dashboard?.completedConsultations || completedAppointments.length;
  const pending = dashboard?.waitingPatients || waitingAppointments.length;

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* 🚨 HIGH PRIORITY EMERGENCY BANNER (If Emergency Patient Waiting for this doctor) */}
      {emergencyWaiting && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-600 text-white shadow-xl border-2 border-white animate-pulse flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-white text-red-600 rounded-xl font-bold text-lg animate-bounce">
              🚨
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-black/40 text-amber-300 font-mono font-black text-xs uppercase tracking-widest border border-amber-400">
                  Critical Emergency Patient
                </span>
                <span className="text-xs font-bold text-white uppercase">Waiting in Lobby Now</span>
              </div>
              <h3 className="text-xl font-black text-white mt-1">
                {emergencyWaiting.patient?.firstName} {emergencyWaiting.patient?.lastName} • Token #{emergencyWaiting.tokenNumber}
              </h3>
              <p className="text-xs text-red-100 opacity-95">
                Priority case registered at {emergencyWaiting.appointmentTime}. TV Screen voice calling is active.
              </p>
            </div>
          </div>

          <Button
            onClick={() => handleStartSpecificPatient(emergencyWaiting)}
            className="bg-white text-red-700 hover:bg-amber-100 font-black gap-2 shadow-2xl h-11 px-5 text-sm shrink-0"
          >
            <Zap className="w-4 h-4 fill-current text-red-600" />
            <span>⚡ Call Emergency Patient Now</span>
          </Button>
        </div>
      )}

      {/* Top Welcome Bar & Action Hub */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-teal-900 via-teal-800 to-stone-900 text-white p-6 rounded-2xl shadow-lg border border-teal-700/50">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 font-semibold text-xs border border-teal-500/30">
              Doctor OPD Suite • Active
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold mt-1.5 tracking-tight text-white">
            Welcome, Dr. {user?.fullName || 'Doctor'}
          </h1>
          <p className="text-sm text-teal-200 mt-1 opacity-90">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {' • '}
            <span className="font-semibold text-white">{waitingAppointments.length} Patients in Queue</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={() => navigate('/reports')}
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs font-semibold gap-1.5 h-10"
          >
            <FileText className="w-4 h-4" />
            <span>Patient Reports</span>
          </Button>

          <Button
            onClick={handleStartNextConsultation}
            disabled={isStartingNext}
            className="bg-teal-500 hover:bg-teal-400 text-stone-950 font-extrabold gap-2 shadow-lg h-10 px-5 text-sm"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{activeConsultation ? 'Resume Consultation' : 'Call Next Patient'}</span>
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
                <span>Today's Patient Consultation Queue</span>
              </CardTitle>
              <CardDescription className="text-xs text-stone-500 mt-1">
                Live list of scheduled, checked-in, and completed visits for today.
              </CardDescription>
            </div>

            <Tabs value={filterTab} onValueChange={(v) => setFilterTab(v as any)} className="w-full sm:w-auto">
              <TabsList className="grid grid-cols-3 w-full sm:w-auto bg-stone-200/60 dark:bg-stone-800 p-1">
                <TabsTrigger value="all" className="text-xs">All ({todayAppointments.length})</TabsTrigger>
                <TabsTrigger value="waiting" className="text-xs">Waiting ({waitingAppointments.length})</TabsTrigger>
                <TabsTrigger value="completed" className="text-xs">Completed ({completedAppointments.length})</TabsTrigger>
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
                const isEmergency = apt.visitType === 'emergency' || apt.tokenNumber?.startsWith('EMG');

                return (
                  <div
                    key={apt.id}
                    className={cn(
                      'p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors',
                      isEmergency && isCheckedIn
                        ? 'bg-red-50/80 dark:bg-red-950/40 border-l-4 border-l-red-600 animate-pulse'
                        : isActive
                        ? 'bg-teal-50/40 dark:bg-teal-950/30 border-l-4 border-l-teal-600'
                        : 'hover:bg-stone-50/80 dark:hover:bg-stone-900/40'
                    )}
                  >
                    {/* Patient Details */}
                    <div className="flex items-start sm:items-center gap-3.5">
                      <div className={cn(
                        "flex flex-col items-center justify-center w-14 h-14 rounded-xl border flex-shrink-0",
                        isEmergency 
                          ? "bg-red-600 text-white border-red-500 shadow-md"
                          : "bg-stone-100 dark:bg-stone-800 border-stone-200 dark:border-stone-700"
                      )}>
                        <span className={cn("text-[10px] font-bold uppercase", isEmergency ? "text-amber-200" : "text-stone-400")}>
                          {isEmergency ? "EMG" : "Token"}
                        </span>
                        <span className={cn("text-base font-black font-mono", isEmergency ? "text-white" : "text-teal-700 dark:text-teal-400")}>
                          {apt.tokenNumber || `#${apt.queueNumber}`}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-stone-900 dark:text-white text-base">
                            {apt.patient?.firstName || 'Patient'} {apt.patient?.lastName || ''}
                          </h4>
                          <StatusBadge status={apt.status} />
                          {isEmergency ? (
                            <Badge variant="destructive" className="text-[10px] px-2 py-0.5 font-bold uppercase tracking-wider bg-red-600">
                              🚨 Emergency Priority
                            </Badge>
                          ) : apt.visitType ? (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {apt.visitType}
                            </Badge>
                          ) : null}
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
                            <span className={cn("italic max-w-xs truncate font-medium", isEmergency ? "text-red-700 dark:text-red-300" : "text-stone-400")}>
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
                            'font-bold gap-1.5 shadow-sm',
                            isEmergency
                              ? 'bg-red-600 hover:bg-red-700 text-white'
                              : isCheckedIn
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : 'bg-stone-800 hover:bg-stone-900 text-white dark:bg-stone-200 dark:text-stone-900'
                          )}
                          size="sm"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>{isEmergency ? '⚡ Call Emergency Patient' : isCheckedIn ? 'Call Patient' : 'Start Consultation'}</span>
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
