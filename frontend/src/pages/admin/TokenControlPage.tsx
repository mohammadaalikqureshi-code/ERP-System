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
  Download,
  FileText,
  BarChart3,
  Building,
  CalendarRange,
  Table as TableIcon,
  LayoutGrid,
  Tv,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { useToast } from '@/components/ui/use-toast';
import { useDoctors } from '@/api/doctors';
import { useAdminLiveTokens, useBoostEmergencyToken, useUpdateAppointmentStatus, AdminTokenFilters } from '@/api/appointments';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Doctor } from '@/types';
import { cn, formatDoctorName } from '@/lib/utils';

export default function TokenControlPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [period, setPeriod] = useState<'daily' | 'monthly' | 'yearly' | 'all'>('daily');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [showAnalyticsDetails, setShowAnalyticsDetails] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'all' | 'emergency' | 'waiting' | 'in_consultation' | 'completed'>('all');
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Doctors list for filter
  const { data: doctors = [] } = useDoctors();

  // Admin Live Tokens Query with Period filter (daily, monthly, yearly, all)
  const filters: AdminTokenFilters = useMemo(() => ({
    doctorId: selectedDoctorId === 'all' ? undefined : selectedDoctorId,
    status: activeTab === 'all' ? (statusFilter === 'all' ? undefined : statusFilter) : activeTab,
    targetDate: selectedDate,
    search: searchTerm,
    period: period,
  }), [selectedDoctorId, statusFilter, activeTab, selectedDate, searchTerm, period]);

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
    period: 'daily',
    total_tokens_filtered: 0,
    daily: { total: 0, completed: 0, emergency: 0, active_waiting: 0 },
    monthly: { total: 0, completed: 0, emergency: 0, month_name: 'This Month' },
    yearly: { total: 0, completed: 0, emergency: 0, year: '2026' },
    monthly_trend: [],
    departments: [],
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
            <span>${formatDoctorName(docName)}</span>
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

  // Export Token Records to CSV
  const handleExportCSV = () => {
    if (!tokens.length) {
      toast({
        title: 'No Data to Export',
        description: 'There are no token records for the selected period.',
      });
      return;
    }

    const headers = [
      'Token Number',
      'Date',
      'Time',
      'Patient Name',
      'UHID',
      'Age',
      'Gender',
      'Blood Group',
      'Mobile',
      'Doctor Name',
      'Department',
      'Cabin',
      'Visit Type',
      'Status',
      'Notes'
    ];

    const rows = tokens.map((t) => [
      `"${t.tokenNumber || ''}"`,
      `"${t.appointmentDate || ''}"`,
      `"${t.appointmentTime || ''}"`,
      `"${(t.patient?.fullName || '').replace(/"/g, '""')}"`,
      `"${t.patient?.patientCode || ''}"`,
      `"${t.patient?.age || ''}"`,
      `"${t.patient?.gender || ''}"`,
      `"${t.patient?.bloodGroup || ''}"`,
      `"${t.patient?.mobile || ''}"`,
      `"${(t.doctor?.fullName || '').replace(/"/g, '""')}"`,
      `"${(t.department || t.doctor?.department || '').replace(/"/g, '""')}"`,
      `"${t.doctor?.room || ''}"`,
      `"${t.visitType || 'normal'}"`,
      `"${t.status || ''}"`,
      `"${(t.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `medicare_tokens_${period}_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: 'CSV Export Complete',
      description: `Downloaded ${tokens.length} token records for ${period} view.`,
    });
  };

  // Print Complete Records Sheet
  const handlePrintRegister = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Token Records Register - ${period.toUpperCase()}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #111; }
            h1 { margin-bottom: 4px; font-size: 22px; }
            .meta { font-size: 13px; color: #666; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; }
            th { background: #f4f4f4; font-weight: 700; }
            .emg { color: #dc2626; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>SANJEEVANI MULTI-SPECIALTY HOSPITAL</h1>
          <div class="meta">
            Token Registry (${period.toUpperCase()}) | Printed on: ${new Date().toLocaleString()} | Total Records: ${tokens.length}
          </div>
          <table>
            <thead>
              <tr>
                <th>Token #</th>
                <th>Date / Time</th>
                <th>Patient Name</th>
                <th>UHID</th>
                <th>Doctor</th>
                <th>Department</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${tokens.map(t => `
                <tr>
                  <td class="${t.visitType === 'emergency' ? 'emg' : ''}">${t.tokenNumber}</td>
                  <td>${t.appointmentDate || ''} ${t.appointmentTime || ''}</td>
                  <td>${t.patient?.fullName || 'Walk-in'}</td>
                  <td>${t.patient?.patientCode || '-'}</td>
                  <td>${t.doctor?.fullName || '-'}</td>
                  <td>${t.department || t.doctor?.department || 'OPD'}</td>
                  <td>${t.status?.toUpperCase() || ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
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

  // Find max monthly volume for scaling bar chart
  const maxMonthVolume = useMemo(() => {
    if (!analytics.monthly_trend?.length) return 10;
    return Math.max(...analytics.monthly_trend.map((m: any) => m.total), 10);
  }, [analytics.monthly_trend]);

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
                Admin Token Command & Analytics
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
              Live token dispatch, historical records (Daily, Monthly, Yearly), department load distribution, and 80mm slip printing.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-xs font-bold gap-1.5 h-10 px-3.5"
            title="Refresh Token Data"
          >
            <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
            <span>Refresh</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="text-xs font-bold gap-1.5 h-10 px-3.5 border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/40"
            title="Download CSV of Loaded Tokens"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handlePrintRegister}
            className="text-xs font-bold gap-1.5 h-10 px-3.5"
            title="Print Formatted Register"
          >
            <Printer className="w-4 h-4" />
            <span>Print Register</span>
          </Button>

          <Button
            size="sm"
            onClick={() => window.open('/queue/display', '_blank', 'noopener,noreferrer')}
            className="bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold gap-1.5 h-10 px-4 shadow-sm"
            title="Open Live TV Display in New Tab"
          >
            <Tv className="w-4 h-4 text-teal-400" />
            <span>Open Waiting Room TV</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-60 ml-0.5" />
          </Button>
        </div>
      </div>

      {/* 📅 PERIOD SELECTOR (Daily, Monthly, Yearly, All Time) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-muted/40 p-2.5 rounded-2xl border border-stone-200 dark:border-stone-800">
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <span className="text-xs font-bold text-muted-foreground mr-1.5 uppercase tracking-wider flex items-center gap-1">
            <CalendarRange className="w-3.5 h-3.5 text-teal-600" /> View Period:
          </span>
          <div className="grid grid-cols-4 sm:flex gap-1.5 flex-1 sm:flex-initial">
            <button
              onClick={() => setPeriod('daily')}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-xl transition-all shadow-sm border",
                period === 'daily'
                  ? "bg-teal-600 text-white border-teal-600 shadow-teal-600/20"
                  : "bg-card text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800"
              )}
            >
              📅 Daily (Today)
            </button>
            <button
              onClick={() => setPeriod('monthly')}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-xl transition-all shadow-sm border",
                period === 'monthly'
                  ? "bg-teal-600 text-white border-teal-600 shadow-teal-600/20"
                  : "bg-card text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800"
              )}
            >
              📆 Monthly ({analytics.monthly?.month_name || 'This Month'})
            </button>
            <button
              onClick={() => setPeriod('yearly')}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-xl transition-all shadow-sm border",
                period === 'yearly'
                  ? "bg-teal-600 text-white border-teal-600 shadow-teal-600/20"
                  : "bg-card text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800"
              )}
            >
              📈 Yearly (2026)
            </button>
            <button
              onClick={() => setPeriod('all')}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-xl transition-all shadow-sm border",
                period === 'all'
                  ? "bg-teal-600 text-white border-teal-600 shadow-teal-600/20"
                  : "bg-card text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800"
              )}
            >
              🌐 All Time
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAnalyticsDetails(!showAnalyticsDetails)}
            className="text-xs font-semibold gap-1 text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>{showAnalyticsDetails ? 'Hide Trend Charts' : 'Show Monthly & Dept Charts'}</span>
            {showAnalyticsDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </Button>

          <div className="flex items-center bg-card rounded-xl border border-stone-200 dark:border-stone-800 p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                "p-1.5 rounded-lg text-xs font-semibold transition-colors",
                viewMode === 'grid' ? "bg-teal-600 text-white" : "text-stone-500 hover:text-stone-900"
              )}
              title="Cards Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                "p-1.5 rounded-lg text-xs font-semibold transition-colors",
                viewMode === 'table' ? "bg-teal-600 text-white" : "text-stone-500 hover:text-stone-900"
              )}
              title="Table Register View"
            >
              <TableIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 📊 LIVE REAL-TIME ANALYTICS KPI DASHBOARD (Daily, Monthly, Yearly) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Today's Daily Tokens */}
        <Card className="border-stone-200 dark:border-stone-800 shadow-sm bg-card hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Today's Tokens</span>
              <Activity className="w-4 h-4 text-teal-600" />
            </div>
            <div className="text-3xl font-black font-mono text-foreground mt-2 tracking-tight">
              {analytics.daily?.total ?? analytics.total_tokens_today ?? 0}
            </div>
            <div className="text-[11px] font-medium text-muted-foreground mt-1 flex items-center gap-1">
              <span className="text-emerald-600 font-bold">{analytics.daily?.completed ?? 0} done</span> • {analytics.daily?.active_waiting ?? 0} waiting
            </div>
          </CardContent>
        </Card>

        {/* Monthly Tokens Volume */}
        <Card className="border-stone-200 dark:border-stone-800 shadow-sm bg-card hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">This Month</span>
              <Calendar className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-3xl font-black font-mono text-blue-600 dark:text-blue-400 mt-2 tracking-tight">
              {analytics.monthly?.total ?? 0}
            </div>
            <div className="text-[11px] font-medium text-muted-foreground mt-1">
              <span className="font-bold text-foreground">{analytics.monthly?.completed ?? 0}</span> consultations
            </div>
          </CardContent>
        </Card>

        {/* Yearly Tokens Cumulative */}
        <Card className="border-stone-200 dark:border-stone-800 shadow-sm bg-card hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Yearly (2026)</span>
              <TrendingUp className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-3xl font-black font-mono text-purple-600 dark:text-purple-400 mt-2 tracking-tight">
              {analytics.yearly?.total ?? 0}
            </div>
            <div className="text-[11px] font-medium text-muted-foreground mt-1">
              <span className="font-bold text-foreground">{analytics.yearly?.completed ?? 0}</span> total served
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
              {analytics.emergency_active_waiting > 0 ? `🚨 ${analytics.emergency_active_waiting} In Lobby Queue` : 'Priority #1 Cases'}
            </div>
          </CardContent>
        </Card>

        {/* Waiting Lobby */}
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
              <Stethoscope className="w-4 h-4 text-teal-600" />
            </div>
            <div className="text-3xl font-black font-mono text-teal-600 dark:text-teal-400 mt-2 tracking-tight">
              {analytics.in_consultation}
            </div>
            <div className="text-[11px] font-medium text-muted-foreground mt-1">Active doctor visits</div>
          </CardContent>
        </Card>
      </div>

      {/* 📈 COMPREHENSIVE VISUAL ANALYTICS: MONTHLY TREND & DEPARTMENT BREAKDOWN */}
      {showAnalyticsDetails && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 12-Month Volume Bar Distribution */}
          <Card className="lg:col-span-2 border-stone-200 dark:border-stone-800 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-teal-600" />
                    2026 Monthly OPD Token Volume & Trend
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Monthly distribution of hospital tokens, completions, and emergency spikes across Jan–Dec 2026.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="font-mono text-xs">
                  Year Total: {analytics.yearly?.total ?? 0}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="grid grid-cols-12 gap-1.5 items-end h-44 pb-2 border-b border-stone-200 dark:border-stone-800">
                {(analytics.monthly_trend || []).map((m: any, idx: number) => {
                  const barHeight = Math.max(Math.round((m.total / maxMonthVolume) * 130), m.total > 0 ? 12 : 4);
                  const isCurrentMonth = new Date().getMonth() === idx;

                  return (
                    <div key={m.month} className="flex flex-col items-center gap-1 group relative">
                      {/* Tooltip on hover */}
                      <div className="absolute -top-12 hidden group-hover:flex flex-col items-center bg-stone-900 text-white text-[10px] py-1 px-2 rounded-md shadow-lg z-20 whitespace-nowrap pointer-events-none">
                        <span className="font-bold">{m.month}: {m.total} Tokens</span>
                        <span className="text-stone-300 font-normal">{m.completed} Done • {m.emergency} Emg</span>
                      </div>

                      <div className="w-full flex items-end justify-center h-36">
                        <div 
                          style={{ height: `${barHeight}px` }}
                          className={cn(
                            "w-full max-w-[28px] rounded-t-md transition-all duration-300 relative overflow-hidden flex flex-col justify-end",
                            isCurrentMonth 
                              ? "bg-teal-600 shadow-md ring-2 ring-teal-400" 
                              : m.total > 0 
                              ? "bg-stone-300 dark:bg-stone-700 hover:bg-teal-500/80" 
                              : "bg-stone-100 dark:bg-stone-800"
                          )}
                        >
                          {m.emergency > 0 && (
                            <div 
                              style={{ height: `${Math.min(barHeight, Math.max(6, Math.round((m.emergency / Math.max(m.total, 1)) * barHeight)))}px` }}
                              className="w-full bg-red-500" 
                              title={`${m.emergency} Emergency`}
                            />
                          )}
                        </div>
                      </div>

                      <span className={cn(
                        "text-[10px] font-bold",
                        isCurrentMonth ? "text-teal-600 dark:text-teal-400 font-black" : "text-stone-500"
                      )}>
                        {m.month}
                      </span>
                      <span className="text-[9px] font-mono text-stone-400">
                        {m.total}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground pt-3">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-teal-600" />
                    <span>Regular OPD</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-red-500" />
                    <span>Emergency Priority</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm border-2 border-teal-400" />
                    <span>Current Month</span>
                  </span>
                </div>
                <span className="text-[11px] font-medium">Peak Month: {maxMonthVolume} tokens</span>
              </div>
            </CardContent>
          </Card>

          {/* Department Load Breakdown */}
          <Card className="border-stone-200 dark:border-stone-800 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Building className="w-5 h-5 text-teal-600" />
                Department OPD Distribution
              </CardTitle>
              <CardDescription className="text-xs">
                Tokens breakdown by medical specialty.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 space-y-3">
              {analytics.departments?.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No department records found for this period.
                </div>
              ) : (
                analytics.departments.slice(0, 6).map((dept: any) => {
                  const totalTokens = analytics.yearly?.total || 1;
                  const pct = Math.min(100, Math.round((dept.total / totalTokens) * 100));

                  return (
                    <div key={dept.department} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-stone-800 dark:text-stone-200">
                          {dept.department}
                        </span>
                        <span className="font-mono font-bold text-stone-700 dark:text-stone-300">
                          {dept.total} <span className="text-[10px] text-muted-foreground font-normal">({pct}%)</span>
                        </span>
                      </div>
                      <div className="w-full bg-stone-100 dark:bg-stone-800 h-2 rounded-full overflow-hidden flex">
                        <div 
                          style={{ width: `${pct}%` }} 
                          className="bg-teal-600 h-full rounded-full transition-all duration-500" 
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-stone-400">
                        <span>{dept.completed} completed</span>
                        {dept.emergency > 0 && <span className="text-red-500 font-bold">{dept.emergency} emergency</span>}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      )}

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
                      {formatDoctorName(doc.fullName || `${doc.firstName} ${doc.lastName || ''}`)} ({doc.department || 'OPD'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Selector (for Daily View) */}
            {period === 'daily' && (
              <div className="w-full md:w-44">
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="h-10 text-xs sm:text-sm bg-stone-50 dark:bg-stone-900 font-mono font-semibold"
                />
              </div>
            )}
          </div>

          {/* Quick Status Tabs */}
          <div className="border-t pt-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full sm:w-auto">
              <TabsList className="grid grid-cols-5 w-full sm:w-auto bg-stone-100 dark:bg-stone-900 p-1 rounded-xl">
                <TabsTrigger value="all" className="text-xs font-bold px-3 py-1.5">
                  All ({analytics.period === 'daily' ? analytics.total_tokens_today : tokens.length})
                </TabsTrigger>
                <TabsTrigger value="emergency" className="text-xs font-bold px-3 py-1.5 text-red-600 dark:text-red-400">
                  🚨 Emergency
                </TabsTrigger>
                <TabsTrigger value="waiting" className="text-xs font-bold px-3 py-1.5 text-amber-600 dark:text-amber-400">
                  🕒 Waiting
                </TabsTrigger>
                <TabsTrigger value="in_consultation" className="text-xs font-bold px-3 py-1.5 text-purple-600 dark:text-purple-400">
                  🩺 In Cabin
                </TabsTrigger>
                <TabsTrigger value="completed" className="text-xs font-bold px-3 py-1.5 text-emerald-600 dark:text-emerald-400">
                  ✅ Done
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="text-xs text-muted-foreground font-semibold flex items-center gap-2">
              <span>Showing <strong className="font-black text-foreground font-mono text-sm">{tokens.length}</strong> {period} token records</span>
              <Badge variant="outline" className="text-[10px] uppercase font-mono">
                Mode: {viewMode}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 📋 TOKENS DISPLAY (GRID CARDS OR DENSE REGISTER TABLE) */}
      {isLoading ? (
        <div className="p-16 text-center text-muted-foreground">
          <LoadingSpinner size="lg" />
          <p className="mt-3 text-sm font-semibold">Loading {period} tokens and analytics...</p>
        </div>
      ) : tokens.length === 0 ? (
        <Card className="border-dashed p-12 text-center text-muted-foreground">
          <Sparkles className="w-12 h-12 mx-auto text-stone-300 dark:text-stone-700 mb-3" />
          <h3 className="text-lg font-bold text-foreground">No Tokens Found</h3>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            No tokens match your current filter criteria for the {period} period.
          </p>
        </Card>
      ) : viewMode === 'table' ? (
        /* 📊 TABLE REGISTER VIEW (Dense, Historical, Auditable) */
        <Card className="border-stone-200 dark:border-stone-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-stone-50 dark:bg-stone-900/50">
                <TableRow>
                  <TableHead className="font-bold text-xs">Token #</TableHead>
                  <TableHead className="font-bold text-xs">Date & Time</TableHead>
                  <TableHead className="font-bold text-xs">Patient Details</TableHead>
                  <TableHead className="font-bold text-xs">Doctor & Dept</TableHead>
                  <TableHead className="font-bold text-xs">Cabin</TableHead>
                  <TableHead className="font-bold text-xs">Status</TableHead>
                  <TableHead className="text-right font-bold text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokens.map((t) => {
                  const isEmergency = t.isEmergency || t.visitType === 'emergency' || t.tokenNumber?.startsWith('EMG');
                  const isActiveInRoom = t.status === 'in_consultation' || t.status === 'IN_CONSULTATION';
                  const isWaiting = t.status === 'checked_in' || t.status === 'booked' || t.status === 'scheduled';
                  const docName = (t.doctor?.fullName || 'OPD').replace(/^Dr\.?\s*/i, '');

                  return (
                    <TableRow key={t.id} className={cn(isEmergency && "bg-red-50/40 dark:bg-red-950/20")}>
                      <TableCell className="font-mono font-black text-sm">
                        <div className="flex items-center gap-1.5">
                          {isEmergency && <ShieldAlert className="w-3.5 h-3.5 text-red-600 animate-pulse" />}
                          <span className={cn(isEmergency ? "text-red-600" : "text-teal-700 dark:text-teal-400")}>
                            {t.tokenNumber}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        <div>{t.appointmentDate || selectedDate}</div>
                        <div className="text-muted-foreground">{t.appointmentTime}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-bold text-xs text-stone-900 dark:text-white">
                          {t.patient?.fullName || 'Walk-in Patient'}
                        </div>
                        <div className="text-[11px] text-muted-foreground font-mono flex items-center gap-1.5 mt-0.5">
                          <span>{t.patient?.patientCode || '-'}</span>
                          <span>•</span>
                          <span>{t.patient?.age || '-'}Y / {t.patient?.gender || '-'}</span>
                          <span>•</span>
                          <span className="text-red-600 font-bold">{t.patient?.bloodGroup || 'O+'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="font-semibold text-stone-800 dark:text-stone-200">
                          {formatDoctorName(docName)}
                        </div>
                        <div className="text-[11px] text-teal-600 dark:text-teal-400 font-medium">
                          {t.department || t.doctor?.department || 'General OPD'}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-mono font-semibold">
                        {t.doctor?.room || 'Cabin 101'}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={t.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handlePrintSlip(t)}
                            className="h-8 w-8 hover:bg-stone-100 dark:hover:bg-stone-800"
                            title="Re-print Thermal Slip (80mm)"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </Button>

                          {isEmergency && isWaiting && (
                            <Button
                              size="sm"
                              onClick={() => handleSilenceAndMoveToCabin(t)}
                              className="bg-stone-900 hover:bg-stone-800 text-white text-[11px] font-bold h-7 px-2"
                              title="Silence Alarm & Call to Doctor Cabin"
                            >
                              <VolumeX className="w-3 h-3 text-amber-300 mr-1" /> Silence
                            </Button>
                          )}

                          {!isEmergency && isWaiting && (
                            <Button
                              size="sm"
                              onClick={() => handlePromoteToEmergency(t)}
                              disabled={isBoosting}
                              className="bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold h-7 px-2"
                              title="Promote to Emergency Priority"
                            >
                              <Zap className="w-3 h-3 fill-current mr-1" /> EMG
                            </Button>
                          )}

                          {isActiveInRoom && (
                            <Button
                              size="sm"
                              onClick={() => navigate(`/doctor/consultation/${t.id}`)}
                              className="bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-bold h-7 px-2"
                            >
                              Consult
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      ) : (
        /* 📱 CARDS GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {tokens.map((t) => {
            const isEmergency = t.isEmergency || t.visitType === 'emergency' || t.tokenNumber?.startsWith('EMG');
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
                      <span className="font-bold text-stone-900 dark:text-stone-100 text-sm">{formatDoctorName(docName)}</span>
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
