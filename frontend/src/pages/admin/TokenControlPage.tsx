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
  Flame
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { PageHeader } from '@/components/shared/PageHeader';
import { useToast } from '@/components/ui/use-toast';
import { useDoctors } from '@/api/doctors';
import { useAdminLiveTokens, useBoostEmergencyToken, AdminTokenFilters } from '@/api/appointments';
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

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Token Slip - ${tokenItem.tokenNumber}</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body {
              font-family: 'Courier New', Courier, monospace;
              width: 72mm;
              margin: 0 auto;
              padding: 10px 4px;
              color: #000;
              background: #fff;
              font-size: 12px;
              line-height: 1.3;
            }
            .text-center { text-align: center; }
            .bold { font-weight: bold; }
            .header-title { font-size: 14px; font-weight: bold; margin-bottom: 2px; }
            .token-box {
              border: 2px dashed ${isEmergency ? '#dc2626' : '#000'};
              margin: 10px 0;
              padding: 8px 0;
              text-align: center;
              background: ${isEmergency ? '#fee2e2' : '#f9fafb'};
            }
            .token-num { font-size: 36px; font-weight: 900; font-family: monospace; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .row { display: flex; justify-content: space-between; margin: 3px 0; }
            .emergency-badge {
              background: #dc2626;
              color: #fff;
              padding: 3px;
              font-weight: bold;
              font-size: 11px;
              text-align: center;
              margin-bottom: 6px;
            }
          </style>
        </head>
        <body>
          <div class="text-center">
            <div class="header-title">SANJEEVANI HOSPITAL</div>
            <div style="font-size: 10px;">Central OPD Waiting Lounge</div>
            <div style="font-size: 10px;">Date: ${now.toLocaleDateString('en-IN')} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </div>

          ${isEmergency ? '<div class="emergency-badge">🚨 CRITICAL EMERGENCY TOKEN</div>' : ''}

          <div class="token-box">
            <div style="font-size: 10px; font-weight: bold;">TOKEN NUMBER</div>
            <div class="token-num">${tokenItem.tokenNumber}</div>
            <div style="font-size: 10px;">Status: ${tokenItem.status.toUpperCase()}</div>
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
            <span>Dr. ${tokenItem.doctor?.fullName || 'OPD'}</span>
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
          <div class="text-center" style="font-size: 10px; margin-top: 10px;">
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-teal-600 text-white rounded-xl shadow-md">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900 dark:text-white">
                  Super Admin Token Command Center
                </h1>
                <span className={cn(
                  "px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1.5",
                  isConnected ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-stone-100 text-stone-600"
                )}>
                  <span className={cn("w-2 h-2 rounded-full", isConnected ? "bg-emerald-500 animate-ping" : "bg-stone-400")} />
                  {isConnected ? "Live Real-Time Sync" : "Connecting..."}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
                Centralized real-time monitoring and management of all hospital OPD and Emergency Tokens.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-xs font-semibold gap-1.5 h-9"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />
            <span>Refresh Live Data</span>
          </Button>

          <Button
            size="sm"
            onClick={() => window.open('/queue/display', '_blank')}
            className="bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold gap-1.5 h-9"
          >
            <Eye className="w-3.5 h-3.5" />
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
            <div className="text-3xl font-black font-mono text-foreground mt-2">
              {analytics.total_tokens_today}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-emerald-500" />
              <span>All OPD departments</span>
            </div>
          </CardContent>
        </Card>

        {/* 🚨 Emergency Tokens (Flashing Red) */}
        <Card className={cn(
          "shadow-sm transition-all border-2",
          analytics.emergency_tokens_today > 0 
            ? "border-red-500 bg-red-50/50 dark:bg-red-950/30 shadow-[0_0_15px_rgba(239,68,68,0.15)]" 
            : "border-stone-200 dark:border-stone-800"
        )}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
                🚨 Emergency
              </span>
              <ShieldAlert className="w-4 h-4 text-red-600 animate-bounce" />
            </div>
            <div className="text-3xl font-black font-mono text-red-600 dark:text-red-400 mt-2">
              {analytics.emergency_tokens_today}
            </div>
            <div className="text-[10px] font-bold text-red-600 dark:text-red-400 mt-1">
              {analytics.emergency_active_waiting > 0 ? `🚨 ${analytics.emergency_active_waiting} Waiting in Lobby!` : 'All attended'}
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
            <div className="text-3xl font-black font-mono text-teal-600 dark:text-teal-400 mt-2">
              {analytics.regular_tokens_today}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">Standard walk-ins</div>
          </CardContent>
        </Card>

        {/* Waiting in Lobby */}
        <Card className="border-stone-200 dark:border-stone-800 shadow-sm bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Waiting Lobby</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-3xl font-black font-mono text-amber-600 dark:text-amber-400 mt-2">
              {analytics.waiting_lobby}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">In line for consultation</div>
          </CardContent>
        </Card>

        {/* In Consultation (Active Doctors) */}
        <Card className="border-stone-200 dark:border-stone-800 shadow-sm bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">In Cabin</span>
              <Stethoscope className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-3xl font-black font-mono text-purple-600 dark:text-purple-400 mt-2">
              {analytics.in_consultation}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">Active doctor sessions</div>
          </CardContent>
        </Card>

        {/* Completed Consultations */}
        <Card className="border-stone-200 dark:border-stone-800 shadow-sm bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Completed</span>
              <CheckCircle className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-2">
              {analytics.completed_consultations}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">Prescriptions signed</div>
          </CardContent>
        </Card>
      </div>

      {/* 🔍 REFINING TOOLBAR: SEARCH & FILTERS */}
      <Card className="border-stone-200 dark:border-stone-800 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search Token (EMG-01, A-101), Patient Name, Mobile Number, UHID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-10 text-xs sm:text-sm bg-stone-50 dark:bg-stone-900"
              />
            </div>

            {/* Doctor Filter */}
            <div className="w-full md:w-64">
              <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
                <SelectTrigger className="h-10 text-xs bg-stone-50 dark:bg-stone-900">
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
                className="h-10 text-xs bg-stone-50 dark:bg-stone-900 font-mono"
              />
            </div>
          </div>

          {/* Quick Status Tabs */}
          <div className="border-t pt-3 flex flex-col sm:flex-row items-center justify-between gap-3">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full sm:w-auto">
              <TabsList className="grid grid-cols-5 w-full sm:w-auto bg-stone-100 dark:bg-stone-900 p-1 text-xs">
                <TabsTrigger value="all" className="text-[11px] font-bold">
                  All ({analytics.total_tokens_today})
                </TabsTrigger>
                <TabsTrigger value="emergency" className="text-[11px] font-bold text-red-600 dark:text-red-400">
                  🚨 Emergency ({analytics.emergency_tokens_today})
                </TabsTrigger>
                <TabsTrigger value="waiting" className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                  🕒 Waiting ({analytics.waiting_lobby})
                </TabsTrigger>
                <TabsTrigger value="in_consultation" className="text-[11px] font-bold text-purple-600 dark:text-purple-400">
                  🩺 In Cabin ({analytics.in_consultation})
                </TabsTrigger>
                <TabsTrigger value="completed" className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  ✅ Done ({analytics.completed_consultations})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="text-xs text-muted-foreground font-medium">
              Showing <span className="font-bold text-foreground font-mono">{tokens.length}</span> matching tokens
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 📋 LIVE TOKENS GRID / CARDS VIEW */}
      {isLoading ? (
        <div className="p-16 text-center text-muted-foreground">
          <LoadingSpinner size="lg" />
          <p className="mt-3 text-xs">Loading live token command center...</p>
        </div>
      ) : tokens.length === 0 ? (
        <Card className="border-dashed p-12 text-center text-muted-foreground">
          <Sparkles className="w-10 h-10 mx-auto text-stone-300 dark:text-stone-700 mb-3" />
          <h3 className="text-base font-bold text-foreground">No Tokens Found</h3>
          <p className="text-xs text-muted-foreground mt-1">
            No tokens match your current filter criteria or date.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tokens.map((t) => {
            const isEmergency = t.isEmergency || t.tokenNumber?.startsWith('EMG');
            const isActiveInRoom = t.status === 'in_consultation' || t.status === 'IN_CONSULTATION';
            const isWaiting = t.status === 'checked_in' || t.status === 'booked' || t.status === 'scheduled';
            const isCompleted = t.status === 'completed' || t.status === 'COMPLETED';

            return (
              <Card 
                key={t.id}
                className={cn(
                  "relative overflow-hidden transition-all border-2 shadow-sm hover:shadow-md",
                  isEmergency 
                    ? "border-red-500 bg-gradient-to-br from-red-950/20 via-card to-card shadow-[0_0_20px_rgba(239,68,68,0.15)] ring-1 ring-red-500/30" 
                    : isActiveInRoom
                    ? "border-teal-500 bg-teal-50/20 dark:bg-teal-950/20"
                    : "border-stone-200 dark:border-stone-800"
                )}
              >
                {/* Emergency Top Stripe */}
                {isEmergency && (
                  <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-600 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 flex items-center justify-between animate-pulse">
                    <span className="flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" />
                      CRITICAL EMERGENCY PRIORITY
                    </span>
                    <span className="bg-black/40 px-1.5 py-0.2 rounded font-mono">PRIORITY #1</span>
                  </div>
                )}

                <CardContent className="p-5 space-y-4">
                  {/* Token Header Row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-16 h-16 rounded-2xl flex flex-col items-center justify-center border-2 font-mono flex-shrink-0 shadow-sm",
                        isEmergency 
                          ? "bg-red-600 text-white border-red-400 shadow-red-500/30" 
                          : isActiveInRoom
                          ? "bg-teal-600 text-white border-teal-400"
                          : "bg-stone-100 dark:bg-stone-800 text-teal-700 dark:text-teal-400 border-stone-200 dark:border-stone-700"
                      )}>
                        <span className={cn("text-[9px] font-bold uppercase", isEmergency ? "text-amber-200" : "text-muted-foreground")}>
                          {isEmergency ? "EMG" : "TOKEN"}
                        </span>
                        <span className="text-xl font-black tracking-tight">
                          {t.tokenNumber}
                        </span>
                      </div>

                      <div>
                        <div className="text-base font-bold text-foreground flex items-center gap-1.5">
                          <span>{t.patient?.fullName || 'Walk-in Patient'}</span>
                        </div>
                        <div className="text-xs text-muted-foreground font-mono flex items-center gap-2 mt-0.5">
                          <span>UHID: {t.patient?.patientCode || '-'}</span>
                          <span>•</span>
                          <span>{t.patient?.age || '-'}Y / {t.patient?.gender || '-'}</span>
                          <span>•</span>
                          <span className="font-bold text-red-600 dark:text-red-400">{t.patient?.bloodGroup || 'O+'}</span>
                        </div>
                        {t.patient?.mobile && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-stone-400" />
                            <span>{t.patient.mobile}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <StatusBadge status={t.status} />
                  </div>

                  {/* Doctor & Department Banner */}
                  <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200/60 dark:border-stone-800 text-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground font-medium">Consulting Doctor:</span>
                      <span className="font-bold text-foreground">Dr. {t.doctor?.fullName || 'OPD'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground font-medium">Department & Cabin:</span>
                      <span className="font-semibold text-teal-700 dark:text-teal-400">
                        {t.department || t.doctor?.department || 'General OPD'} • {t.doctor?.room || 'Cabin 101'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-muted-foreground pt-1 border-t border-stone-200 dark:border-stone-800">
                      <span>Token Time: <strong className="font-mono text-foreground">{t.appointmentTime}</strong></span>
                      <span>Queue Pos: <strong className="font-mono text-foreground">#{t.queueNumber}</strong></span>
                    </div>
                  </div>

                  {/* Notes / Reason */}
                  {t.notes && (
                    <div className="text-xs italic text-stone-500 bg-amber-50/50 dark:bg-amber-950/20 p-2 rounded-lg border border-amber-200/40">
                      "{t.notes}"
                    </div>
                  )}

                  {/* Super Admin Quick Actions */}
                  <div className="pt-2 border-t flex items-center justify-between gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePrintSlip(t)}
                      className="text-xs font-semibold gap-1 h-8 px-2.5 hover:bg-stone-100"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print Slip</span>
                    </Button>

                    {!isEmergency && isWaiting && (
                      <Button
                        size="sm"
                        onClick={() => handlePromoteToEmergency(t)}
                        disabled={isBoosting}
                        className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold gap-1 h-8 px-2.5 shadow-sm"
                      >
                        <Zap className="w-3.5 h-3.5 fill-current" />
                        <span>Promote to Emergency</span>
                      </Button>
                    )}

                    {isActiveInRoom && (
                      <Button
                        size="sm"
                        onClick={() => navigate(`/doctor/consultation/${t.id}`)}
                        className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold gap-1 h-8 px-2.5 shadow-sm"
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
