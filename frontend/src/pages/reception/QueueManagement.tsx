import React, { useState } from 'react';
import { useQueueToday, useUpdateAppointmentStatus } from '@/api/appointments';
import { useDoctors } from '@/api/doctors';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { PageHeader } from '@/components/shared/PageHeader';
import { useToast } from '@/components/ui/use-toast';
import { Clock, UserCircle, Play, CheckCircle, SkipForward } from 'lucide-react';
import { Appointment, Doctor } from '@/types';

const QueueManagementContent = () => {
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('all');
  const { toast } = useToast();
  
  const { data: doctors } = useDoctors();
  const { data: queueData, isLoading } = useQueueToday(selectedDoctorId === 'all' ? undefined : selectedDoctorId);
  const { mutate: updateStatus } = useUpdateAppointmentStatus();

  // The useWebSocket hook auto-invalidates React Query keys via EVENT_QUERY_KEYS
  // in lib/realtime.ts — no manual invalidation needed here.
  const { isConnected, isReconnecting } = useWebSocket({
    url: '/ws/queue',
  });

  const handleStatusChange = (id: string, status: string) => {
    updateStatus({ id, status }, {
      onSuccess: () => {
        toast({ title: "Status Updated", description: `Appointment marked as ${status.replace('_', ' ')}` });
      }
    });
  };

  if (isLoading) return <div className="flex h-full items-center justify-center"><LoadingSpinner size="lg" /></div>;

  const renderPatientCard = (appointment: Appointment, actions: React.ReactNode) => (
    <Card key={appointment.id} className="mb-3 shadow-sm border-l-4" style={{ borderLeftColor: `var(--status-${appointment.status.toLowerCase().replace('_', '-')})` }}>
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div>
            <div className="text-2xl font-bold font-mono">{appointment.tokenNumber}</div>
            <div className="font-medium text-sm flex items-center gap-1 mt-1">
              <UserCircle className="h-4 w-4" /> 
              {appointment.patient?.firstName} {appointment.patient?.lastName}
            </div>
          </div>
          <StatusBadge status={appointment.status} />
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-1 mb-4">
          <Clock className="h-3 w-3" /> Scheduled: {appointment.appointmentTime}
          {selectedDoctorId === 'all' && (
            <span className="ml-2 block mt-1 truncate">Dr. {appointment.doctor?.lastName}</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {actions}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <PageHeader title="Live Queue Management" description="Manage patient flow and consultation status." />
          {isReconnecting ? (
            <span className="text-xs text-amber-500 font-medium ml-2 animate-pulse">Reconnecting to live updates...</span>
          ) : (
            <span className="text-xs font-medium ml-2 flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-stone-400'}`} aria-hidden />
              <span className={isConnected ? 'text-emerald-600' : 'text-stone-500'}>
                {isConnected ? 'Live' : 'Offline'}
              </span>
            </span>
          )}
        </div>
        <div className="w-64">
          <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by Doctor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Doctors</SelectItem>
              {doctors?.map((doc: Doctor) => (
                <SelectItem key={doc.id} value={doc.id}>Dr. {doc.firstName} {doc.lastName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto pb-4">
        <div className="flex gap-4 h-full min-w-[1000px]">
          
          {/* WAITING (BOOKED) */}
          <div className="flex-1 flex flex-col bg-muted/30 rounded-xl p-4">
            <h3 className="font-semibold text-lg mb-4 flex items-center justify-between">
              Waiting (Booked) <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-sm">{queueData?.waiting?.length || 0}</span>
            </h3>
            <div className="overflow-y-auto flex-1 pr-2">
              {queueData?.waiting?.map((apt: Appointment) => renderPatientCard(apt, (
                <Button size="sm" className="w-full bg-status-checked-in hover:bg-status-checked-in/90" onClick={() => handleStatusChange(apt.id, 'CHECKED_IN')}>
                  Check In Patient
                </Button>
              )))}
              {(!queueData?.waiting || queueData.waiting.length === 0) && <div className="text-center text-muted-foreground text-sm py-8">No patients waiting</div>}
            </div>
          </div>

          {/* NEXT UP (CHECKED IN) */}
          <div className="flex-1 flex flex-col bg-muted/30 rounded-xl p-4 border border-status-checked-in/30">
            <h3 className="font-semibold text-lg mb-4 flex items-center justify-between text-status-checked-in">
              Next Up (Ready) <span className="bg-status-checked-in/10 px-2 py-0.5 rounded-full text-sm">{queueData?.next ? '1' : '0'}</span>
            </h3>
            <div className="overflow-y-auto flex-1 pr-2">
              {queueData?.next && renderPatientCard(queueData.next, (
                <>
                  <Button size="sm" className="flex-1 bg-status-in-consultation hover:bg-status-in-consultation/90" onClick={() => handleStatusChange(queueData.next!.id, 'IN_CONSULTATION')}>
                    <Play className="mr-1 h-3 w-3" /> Start
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 text-status-skipped hover:text-status-skipped hover:bg-status-skipped/10" onClick={() => handleStatusChange(queueData.next!.id, 'SKIPPED')}>
                    <SkipForward className="mr-1 h-3 w-3" /> Skip
                  </Button>
                </>
              ))}
              {!queueData?.next && <div className="text-center text-muted-foreground text-sm py-8">No patient ready next</div>}
            </div>
          </div>

          {/* NOW SERVING (IN CONSULTATION) */}
          <div className="flex-1 flex flex-col bg-muted/30 rounded-xl p-4 border-2 border-status-in-consultation/50">
            <h3 className="font-semibold text-lg mb-4 flex items-center justify-between text-status-in-consultation">
              Now Serving <span className="bg-status-in-consultation/10 px-2 py-0.5 rounded-full text-sm">{queueData?.current ? '1' : '0'}</span>
            </h3>
            <div className="overflow-y-auto flex-1 pr-2">
              {queueData?.current && renderPatientCard(queueData.current, (
                <Button size="sm" className="w-full bg-status-completed hover:bg-status-completed/90" onClick={() => handleStatusChange(queueData.current!.id, 'COMPLETED')}>
                  <CheckCircle className="mr-1 h-3 w-3" /> Mark Completed
                </Button>
              ))}
              {!queueData?.current && <div className="text-center text-muted-foreground text-sm py-8 text-status-in-consultation/50">Doctor is available</div>}
            </div>
          </div>

          {/* DONE (COMPLETED / SKIPPED) */}
          <div className="flex-1 flex flex-col bg-muted/30 rounded-xl p-4">
            <h3 className="font-semibold text-lg mb-4 flex items-center justify-between">
              Done <span className="bg-muted px-2 py-0.5 rounded-full text-sm">{(queueData?.completed?.length || 0) + (queueData?.skipped?.length || 0)}</span>
            </h3>
            <div className="overflow-y-auto flex-1 pr-2 opacity-75">
              {queueData?.skipped?.map((apt: Appointment) => renderPatientCard(apt, (
                <Button size="sm" variant="outline" className="w-full" onClick={() => handleStatusChange(apt.id, 'CHECKED_IN')}>
                  Move Back to Queue
                </Button>
              )))}
              {queueData?.completed?.map((apt: Appointment) => renderPatientCard(apt, (
                <div className="text-xs text-status-completed font-medium flex items-center"><CheckCircle className="h-3 w-3 mr-1" /> Consultation Done</div>
              )))}
              {(!queueData?.completed?.length && !queueData?.skipped?.length) && <div className="text-center text-muted-foreground text-sm py-8">No completed patients</div>}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default function QueueManagement() {
  return (
    <ErrorBoundary>
      <QueueManagementContent />
    </ErrorBoundary>
  );
}
