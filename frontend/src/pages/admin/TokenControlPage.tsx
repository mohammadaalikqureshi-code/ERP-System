import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Activity, 
  Search, 
  Filter, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Stethoscope, 
  User, 
  Printer, 
  Sparkles, 
  Zap, 
  Phone, 
  ShieldAlert, 
  RefreshCw, 
  Radio, 
  Users, 
  Calendar,
  Eye,
  SlidersHorizontal,
  ChevronRight,
  TrendingUp,
  Flame,
  HeartPulse,
  VolumeX,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { useToast } from '@/components/ui/use-toast';
import { useDoctors } from '@/api/doctors';
import { useAdminLiveTokens, useBoostEmergencyToken, useUpdateAppointmentStatus, AdminTokenFilters } from '@/api/appointments';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Doctor } from '@/types';
import { cn } from '@/lib/utils';

export default function TokenControlPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'all' | 'emergency' | 'waiting' | 'in_consultation' | 'completed'>('all');
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Doctors list for filter
  const { data: doctors = [] } = useDoctors();

  // Admin Live Tokens Query
  const filters: AdminTokenFilters = useMemo(() => ({
    doctorId: selectedDoctorId === 'all' ? undefined : selectedDoctorId,
    status: activeTab === 'all' ? (statusFilter === 'all' ? undefined : statusFilter) : activeTab,
    targetDate: selectedDate,
    search: searchTerm,
  }), [selectedDoctorId, statusFilter, activeTab, selectedDate, searchTerm]);

  const { data, isLoading, refetch, isFetching } = useAdminLiveTokens(filters);
  const { mutate: boostEmergency, isPending: isBoosting } = useBoostEmergencyToken();
  const { mutate: updateStatus } = useUpdateAppointmentStatus();

  // Silence Alarm & Move to Cabin
  const handleSilenceAndMoveToCabin = (tokenItem: any) => {
    updateStatus(
      { id: tokenItem.id, status: 'in_consultation' },
      {
        onSuccess: () => {
          toast({
            title: '🔕 Emergency Alarm Silenced',
            description: `Token #${tokenItem.tokenNumber} (${tokenItem.patient?.fullName || 'Patient'}) called to doctor cabin. Alarm stopped immediately.`,
          });
          refetch();
        },
      }
    );
  };

  // Real-time WebSocket connection for instant token sync
  const { isConnected } = useWebSocket({
    url: '/ws/queue',
    onMessage: (event) => {
      if (['APPOINTMENT_CREATED', 'APPOINTMENT_STATUS_CHANGED', 'QUEUE_UPDATED'].includes(event.type)) {
        refetch();
      }
    },
  });

  const analytics = data?.analytics || {
    total_tokens_today: 0,
    emergency_tokens_today: 0,
    emergency_active_waiting: 0,
    waiting_lobby: 0,
    in_consultation: 0,
    completed_consultations: 0,
    regular_tokens_today: 0,
  };

  const tokens: any[] = data?.tokens || [];

  // Super Admin 1-Click Promote to Emergency
  const handlePromoteToEmergency = (tokenItem: any) => {
    boostEmergency(tokenItem.id, {
      onSuccess: (res: any) => {
        toast({
          title: '🚨 Token Promoted to Emergency',
          description: `Token #${tokenItem.tokenNumber} (${tokenItem.patient?.fullName || 'Patient'}) elevated to Emergency Priority 1 with live TV screen announcement.`,
          variant: 'destructive',
        });
      },
      onError: (err: any) => {
        toast({
          title: 'Promotion Failed',
          description: err.response?.data?.message || 'Failed to update token priority.',
          variant: 'destructive',
        });
      },
    });
  };

  // Re-print Isolated 80mm POS Thermal Slip
  const handlePrintSlip = (tokenItem: any) => {
    const printWindow = window.open('', '_blank', 'width=380,height=600');
    if (!printWindow) {
      toast({
        title: 'Pop-up Blocked',
        description: 'Please allow pop-ups to print thermal token slips.',
        variant: 'destructive',
      });
      return;
    }

    const isEmergency = tokenItem.isEmergency || tokenItem.tokenNumber?.startsWith('EMG');
    const now = new Date();
    const docName = (tokenItem.doctor?.fullName || 'OPD').replace(/^Dr\.?\s*/i, '');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Token Slip - ${tokenItem.tokenNumber}</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              width: 72mm;
              margin: 0 auto;
              padding: 10px 4px;
              color: #000;
              background: #fff;
              font-size: 12px;
              line-height: 1.35;
            }
            .text-center { text-align: center; }
            .bold { font-weight: bold; }
            .header-title { font-size: 15px; font-weight: 800; margin-bottom: 2px; }
            .token-box {
              border: 2px dashed ${isEmergency ? '#dc2626' : '#000'};
              margin: 10px 0;
              padding: 8px 0;
              text-align: center;
              background: ${isEmergency ? '#fee2e2' : '#f9fafb'};
            }
            .token-num { font-size: 38px; font-weight: 900; font-family: monospace; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .row { display: flex; justify-content: space-between; margin: 3px 0; }
            .emergency-badge {
              background: #dc2626;
              color: #fff;
              padding: 4px;
              font-weight: 800;
              font-size: 12px;
              text-align: center;
              margin-bottom: 6px;
              border-radius: 4px;
            }
          </style>
        </head>
        <body>
          <div class="text-center">
            <div class="header-title">SANJEEVANI HOSPITAL</div>
            <div style="font-size: 10px; font-weight: 600;">Central OPD Waiting Lounge</div>
            <div style="font-size: 10px; color: #444;">${now.toLocaleDateString('en-IN')} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </div>

          ${isEmergency ? '<div class="emergency-badge">🚨 CRITICAL EMERGENCY TOKEN</div>' : ''}

          <div class="token-box">
            <div style="font-size: 10px; font-weight: 700; color: #555;">YOUR TOKEN NUMBER</div>
            <div class="token-num">${tokenItem.tokenNumber}</div>
            <div style="font-size: 11px; font-weight: 700;">Status: ${tokenItem.status.toUpperCase()}</div>
          </div>

          <div class="divider"></div>

          <div class="row">
            <span class="bold">Patient:</span>
            <span>${tokenItem.patient?.fullName || 'Walk-in Patient'}</span>
          </div>
          <div class="row">
            <span class="bold">UHID:</span>
            <span>${tokenItem.patient?.patientCode || '-'}</span>
          </div>
          <div class="row">
            <span class="bold">Age/Gender:</span>
            <span>${tokenItem.patient?.age || '-'} Y / ${tokenItem.patient?.gender || '-'}</span>
          </div>
          <div class="row">
            <span class="bold">Blood Group:</span>
            <span>${tokenItem.patient?.bloodGroup || '-'}</span>
          </div>

          <div class="divider"></div>

          <div class="row">
            <span class="bold">Doctor:</span>
            <span>Dr. ${docName}</span>
          </div>
          <div class="row">
            <span class="bold">Department:</span>
            <span>${tokenItem.department || tokenItem.doctor?.department || 'General OPD'}</span>
          </div>
          <div class="row">
            <span class="bold">Cabin:</span>
            <span>${tokenItem.doctor?.room || 'Cabin 101'}</span>
          </div>

          <div class="divider"></div>
          <div class="text-center" style="font-size: 10px; margin-top: 10px; color: #444;">
            Please watch the Waiting Room TV screen.<br/>Your token will be announced via voice.
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 400);
  };

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Top Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-5 sm:p-6 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-teal-600 text-white rounded-2xl shadow-md flex items-center justify-center">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-stone-900 dark:text-white">
                Super Admin Token Command Center
              </h1>
              <span className={cn(
                "px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm border",
                isConnected 
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800" 
                  : "bg-stone-100 text-stone-600 border-stone-200"
              )}>
                <span className={cn("w-2 h-2 rounded-full", isConnected ? "bg-emerald-500 animate-ping" : "bg-stone-400")} />
                {isConnected ? "Live Real-Time Sync" : "Connecting..."}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-stone-500 font-medium mt-1">
              Centralized real-time monitoring and management of all hospital OPD and Emergency Tokens.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-xs font-bold gap-1.5 h-10 px-4"
          >
            <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
            <span>Refresh Live</span>
          </Button>

          <Button
            size="sm"
            onClick={() => window.open('/queue/display', '_blank')}
            className="bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold gap-1.5 h-10 px-4 shadow-sm"
          >
            <Eye className="w-4 h-4" />
            <span>Open Waiting Room TV</span>
          </Button>
        </div>
      </div>

      {/* 📊 LIVE REAL-TIME ANALYTICS KPI DASHBOARD */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Total Tokens Today */}
        <Card className="border-stone-200 dark:border-stone-800 shadow-sm bg-card hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total Tokens</span>
              <Activity className="w-4 h-4 text-teal-600" />
            </div>
            <div className="text-3xl font-black font-mono text-foreground mt-2 tracking-tight">
              {analytics.total_tokens_today}
            </div>
            <div className="text-[11px] font-medium text-muted-foreground mt-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              <span>All OPD departments</span>
            </div>
          </CardContent>
        </Card>

        {/* 🚨 Emergency Tokens (Flashing Red) */}
        <Card className={cn(
          "shadow-sm transition-all border-2",
          analytics.emergency_tokens_today > 0 
            ? "border-red-500 bg-red-50/60 dark:bg-red-950/40 shadow-[0_0_15px_rgba(239,68,68,0.15)]" 
            : "border-stone-200 dark:border-stone-800 bg-card"
        )}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-red-600 dark:text-red-400">
                🚨 Emergency
              </span>
              <ShieldAlert className="w-4 h-4 text-red-600 animate-bounce" />
            </div>
            <div className="text-3xl font-black font-mono text-red-600 dark:text-red-400 mt-2 tracking-tight">
              {analytics.emergency_tokens_today}
            </div>
            <div className="text-[11px] font-bold text-red-600 dark:text-red-400 mt-1">
              {analytics.emergency_active_waiting > 0 ? `🚨 ${analytics.emergency_active_waiting} In Lobby Queue` : 'Attended / In Room'}
            </div>
          </CardContent>
        </Card>

        {/* Regular Normal Tokens */}
        <Card className="border-stone-200 dark:border-stone-800 shadow-sm bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Normal Tokens</span>
              <Users className="w-4 h-4 text-teal-600" />
            </div>
            <div className="text-3xl font-black font-mono text-teal-600 dark:text-teal-400 mt-2 tracking-tight">
              {analytics.regular_tokens_today}
            </div>
            <div className="text-[11px] font-medium text-muted-foreground mt-1">Standard walk-ins</div>
          </CardContent>
        </Card>

        {/* Waiting in Lobby */}
        <Card className="border-stone-200 dark:border-stone-800 shadow-sm bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Waiting Lobby</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-3xl font-black font-mono text-amber-600 dark:text-amber-400 mt-2 tracking-tight">
              {analytics.waiting_lobby}
            </div>
            <div className="text-[11px] font-medium text-muted-foreground mt-1">Queued for doctor</div>
          </CardContent>
        </Card>

        {/* In Consultation (Active Doctors) */}
        <Card className="border-stone-200 dark:border-stone-800 shadow-sm bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">In Cabin</span>
              <Stethoscope className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-3xl font-black font-mono text-purple-600 dark:text-purple-400 mt-2 tracking-tight">
              {analytics.in_consultation}
            </div>
            <div className="text-[11px] font-medium text-muted-foreground mt-1">Active doctor visits</div>
          </CardContent>
        </Card>

        {/* Completed Consultations */}
        <Card className="border-stone-200 dark:border-stone-800 shadow-sm bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Completed</span>
              <CheckCircle className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-2 tracking-tight">
              {analytics.completed_consultations}
            </div>
            <div className="text-[11px] font-medium text-muted-foreground mt-1">Prescriptions signed</div>
          </CardContent>
        </Card>
      </div>

      {/* 🔍 REFINING TOOLBAR: SEARCH & FILTERS */}
      <Card className="border-stone-200 dark:border-stone-800 shadow-sm">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search Token (EMG-01, A-101), Patient Name, Mobile Number, UHID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10 text-sm font-medium bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800"
              />
            </div>

            {/* Doctor Filter */}
            <div className="w-full md:w-72">
              <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
                <SelectTrigger className="h-10 text-xs sm:text-sm font-semibold bg-stone-50 dark:bg-stone-900">
                  <SelectValue placeholder="Filter by Doctor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">🏥 All Doctors & Departments</SelectItem>
                  {doctors.map((doc: Doctor) => (
                    <SelectItem key={doc.id} value={doc.id}>
                      Dr. {doc.firstName} {doc.lastName} ({doc.department || 'OPD'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Selector */}
            <div className="w-full md:w-44">
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-10 text-xs sm:text-sm bg-stone-50 dark:bg-stone-900 font-mono font-semibold"
              />
            </div>
          </div>

          {/* Quick Status Tabs */}
          <div className="border-t pt-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full sm:w-auto">
              <TabsList className="grid grid-cols-5 w-full sm:w-auto bg-stone-100 dark:bg-stone-900 p-1 rounded-xl">
                <TabsTrigger value="all" className="text-xs font-bold px-3 py-1.5">
                  All ({analytics.total_tokens_today})
                </TabsTrigger>
                <TabsTrigger value="emergency" className="text-xs font-bold px-3 py-1.5 text-red-600 dark:text-red-400">
                  🚨 Emergency ({analytics.emergency_tokens_today})
                </TabsTrigger>
                <TabsTrigger value="waiting" className="text-xs font-bold px-3 py-1.5 text-amber-600 dark:text-amber-400">
                  🕒 Waiting ({analytics.waiting_lobby})
                </TabsTrigger>
                <TabsTrigger value="in_consultation" className="text-xs font-bold px-3 py-1.5 text-purple-600 dark:text-purple-400">
                  🩺 In Cabin ({analytics.in_consultation})
                </TabsTrigger>
                <TabsTrigger value="completed" className="text-xs font-bold px-3 py-1.5 text-emerald-600 dark:text-emerald-400">
                  ✅ Done ({analytics.completed_consultations})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="text-xs text-muted-foreground font-semibold">
              Showing <span className="font-black text-foreground font-mono text-sm">{tokens.length}</span> matching tokens
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 📋 LIVE TOKENS GRID / CARDS VIEW */}
      {isLoading ? (
        <div className="p-16 text-center text-muted-foreground">
          <LoadingSpinner size="lg" />
          <p className="mt-3 text-sm font-semibold">Loading live token command center...</p>
        </div>
      ) : tokens.length === 0 ? (
        <Card className="border-dashed p-12 text-center text-muted-foreground">
          <Sparkles className="w-12 h-12 mx-auto text-stone-300 dark:text-stone-700 mb-3" />
          <h3 className="text-lg font-bold text-foreground">No Tokens Found</h3>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            No tokens match your current filter criteria or date.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {tokens.map((t) => {
            const isEmergency = t.isEmergency || t.tokenNumber?.startsWith('EMG');
            const isActiveInRoom = t.status === 'in_consultation' || t.status === 'IN_CONSULTATION';
            const isWaiting = t.status === 'checked_in' || t.status === 'booked' || t.status === 'scheduled';
            const isCompleted = t.status === 'completed' || t.status === 'COMPLETED';
            const docName = (t.doctor?.fullName || 'OPD').replace(/^Dr\.?\s*/i, '');

            return (
              <Card 
                key={t.id}
                className={cn(
                  "relative overflow-hidden transition-all border-2 shadow-sm hover:shadow-md rounded-2xl flex flex-col justify-between",
                  isEmergency 
                    ? "border-red-500 bg-gradient-to-br from-red-950/20 via-card to-card shadow-[0_0_20px_rgba(239,68,68,0.15)] ring-1 ring-red-500/40" 
                    : isActiveInRoom
                    ? "border-teal-500 bg-teal-50/20 dark:bg-teal-950/20"
                    : "border-stone-200 dark:border-stone-800 bg-card"
                )}
              >
                {/* Emergency Top Stripe */}
                {isEmergency && (
                  <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-600 text-white text-[11px] font-black uppercase tracking-wider px-3.5 py-1.5 flex items-center justify-between animate-pulse">
                    <span className="flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      CRITICAL EMERGENCY PRIORITY
                    </span>
                    <span className="bg-black/50 px-2 py-0.5 rounded font-mono text-[10px] font-bold">PRIORITY #1</span>
                  </div>
                )}

                <CardContent className="p-5 space-y-4">
                  {/* Token Header Row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* Token Number Box (Wide, Bold, Single Line) */}
                      <div className={cn(
                        "min-w-[82px] h-[72px] rounded-2xl flex flex-col items-center justify-center border-2 font-mono flex-shrink-0 shadow-sm px-2",
                        isEmergency 
                          ? "bg-red-600 text-white border-red-400 shadow-red-500/30" 
                          : isActiveInRoom
                          ? "bg-teal-600 text-white border-teal-400"
                          : "bg-stone-100 dark:bg-stone-800 text-teal-700 dark:text-teal-400 border-stone-200 dark:border-stone-700"
                      )}>
                        <span className={cn("text-[10px] font-bold uppercase tracking-wider", isEmergency ? "text-amber-200" : "text-stone-400")}>
                          {isEmergency ? "EMG" : "TOKEN"}
                        </span>
                        <span className="text-2xl font-black tracking-tight whitespace-nowrap">
                          {t.tokenNumber}
                        </span>
                      </div>

                      {/* Patient Info */}
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="text-base sm:text-lg font-black text-stone-900 dark:text-white truncate">
                          {t.patient?.fullName || 'Walk-in Patient'}
                        </div>

                        {/* Patient Tags Row (Clean & Readable) */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-mono text-[11px] font-bold border border-stone-200/60 dark:border-stone-700">
                            {t.patient?.patientCode || 'PT-00000'}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-[11px] font-semibold">
                            {t.patient?.age || '-'}Y • {t.patient?.gender || '-'}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300 text-[11px] font-bold border border-red-200 dark:border-red-900">
                            🩸 {t.patient?.bloodGroup || 'O+'}
                          </span>
                        </div>

                        {t.patient?.mobile && (
                          <div className="text-xs font-semibold text-stone-500 dark:text-stone-400 flex items-center gap-1 font-mono">
                            <Phone className="w-3 h-3 text-stone-400" />
                            <span>{t.patient.mobile}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <StatusBadge status={t.status} />
                  </div>

                  {/* Doctor & Department Banner */}
                  <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 text-xs space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-stone-500 dark:text-stone-400 font-medium">Consulting Doctor:</span>
                      <span className="font-bold text-stone-900 dark:text-stone-100 text-sm">Dr. {docName}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-stone-500 dark:text-stone-400 font-medium">Department & Cabin:</span>
                      <span className="font-bold text-teal-700 dark:text-teal-400">
                        {t.department || t.doctor?.department || 'General OPD'} • {t.doctor?.room || 'Cabin 101'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-stone-500 pt-1.5 border-t border-stone-200 dark:border-stone-800">
                      <span>Token Time: <strong className="font-mono text-stone-900 dark:text-stone-100 font-bold">{t.appointmentTime}</strong></span>
                      <span>Queue Pos: <strong className="font-mono text-stone-900 dark:text-stone-100 font-bold">#{t.queueNumber}</strong></span>
                    </div>
                  </div>

                  {/* Notes / Reason */}
                  {t.notes && (
                    <div className="text-xs font-medium italic text-stone-600 dark:text-stone-300 bg-amber-50/60 dark:bg-amber-950/30 p-2.5 rounded-xl border border-amber-200/50">
                      "{t.notes}"
                    </div>
                  )}

                  {/* Super Admin Quick Actions */}
                  <div className="pt-2 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePrintSlip(t)}
                      className="text-xs font-bold gap-1.5 h-8 px-3 hover:bg-stone-100 dark:hover:bg-stone-800"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print Slip</span>
                    </Button>

                    {isEmergency && isWaiting && (
                      <Button
                        size="sm"
                        onClick={() => handleSilenceAndMoveToCabin(t)}
                        className="bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold gap-1.5 h-8 px-3 shadow-sm"
                      >
                        <VolumeX className="w-3.5 h-3.5 text-amber-300" />
                        <span>🔕 Silence Alarm (Call to Cabin)</span>
                      </Button>
                    )}

                    {!isEmergency && isWaiting && (
                      <Button
                        size="sm"
                        onClick={() => handlePromoteToEmergency(t)}
                        disabled={isBoosting}
                        className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold gap-1.5 h-8 px-3 shadow-sm"
                      >
                        <Zap className="w-3.5 h-3.5 fill-current" />
                        <span>Promote to Emergency</span>
                      </Button>
                    )}

                    {isActiveInRoom && (
                      <Button
                        size="sm"
                        onClick={() => navigate(`/doctor/consultation/${t.id}`)}
                        className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold gap-1.5 h-8 px-3 shadow-sm"
                      >
                        <Stethoscope className="w-3.5 h-3.5" />
                        <span>View Consultation</span>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
