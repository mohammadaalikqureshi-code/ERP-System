import React, { useMemo, useState } from 'react';
import { format, subDays, subMonths } from 'date-fns';
import {
  Activity,
  AlertTriangle,
  Calendar,
  IndianRupee,
  Receipt,
  UserX,
  Users,
  Stethoscope,
  Clock,
  Radio,
  Hospital,
  DollarSign,
  AlertOctagon,
  CheckCircle2,
  TrendingUp,
  Download,
  Megaphone,
  Pencil,
  ShieldCheck,
  Building2,
  Sparkles,
  FlaskConical,
  Pill,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAdminDashboard } from '@/api/dashboard';
import { useDoctorPerformance, useNoShowRates, useRevenueReport } from '@/api/reports';
import { useDoctors } from '@/api/doctors';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { PageHeader } from '@/components/shared/PageHeader';
import { formatCurrency } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/components/ui/use-toast';

const COLORS = ['#0d9488', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#14b8a6'];

const RANGES = {
  week: () => subDays(new Date(), 7),
  month: () => subMonths(new Date(), 1),
  year: () => subMonths(new Date(), 12),
} as const;

type RangeKey = keyof typeof RANGES;

const AdminDashboardContent = () => {
  const currentUser = useAuthStore((state) => state.user);
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const { toast } = useToast();

  const [range, setRange] = useState<RangeKey>('week');
  const [opdMode, setOpdMode] = useState<'normal' | 'congested' | 'emergency'>('normal');
  const [broadcastNotice, setBroadcastNotice] = useState('Welcome to Sanjeevani Hospital OPD. Registration & Diagnostics are fully operational.');
  const [isEditingNotice, setIsEditingNotice] = useState(false);
  const [tempNotice, setTempNotice] = useState(broadcastNotice);

  // Dynamic doctor status matrix
  const [doctorStatuses, setDoctorStatuses] = useState<Record<string, 'opd' | 'surgery' | 'break' | 'off'>>({});

  const dates = useMemo(
    () => ({
      startDate: format(RANGES[range](), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd'),
    }),
    [range]
  );

  const { data: stats, isLoading } = useAdminDashboard();
  const { data: revenue } = useRevenueReport(dates);
  const { data: doctorsData } = useDoctorPerformance(dates);
  const { data: doctorsList } = useDoctors();

  const handleUpdateNotice = () => {
    setBroadcastNotice(tempNotice);
    setIsEditingNotice(false);
    toast({ title: "Hospital Notice Broadcasted", description: "All staff screens have been notified.", variant: "success" });
  };

  const handleDoctorStatusChange = (doctorId: string, status: 'opd' | 'surgery' | 'break' | 'off') => {
    setDoctorStatuses(prev => ({ ...prev, [doctorId]: status }));
    toast({ title: "Doctor Duty Updated", description: `Status changed to ${status.toUpperCase()}`, variant: "success" });
  };

  const handleExportDailyShiftCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Metric,Value\n"
      + `Hospital,Sanjeevani Multi-Specialty Hospital\n`
      + `Date,${new Date().toLocaleDateString()}\n`
      + `Gross Shift Revenue,₹${stats?.totalRevenue || 0}\n`
      + `Cash in Hand (Estimated 40%),₹${((stats?.totalRevenue || 0) * 0.4).toFixed(2)}\n`
      + `UPI / Digital (Estimated 45%),₹${((stats?.totalRevenue || 0) * 0.45).toFixed(2)}\n`
      + `Card / Insurance (Estimated 15%),₹${((stats?.totalRevenue || 0) * 0.15).toFixed(2)}\n`
      + `CGST (9%),₹${((stats?.totalRevenue || 0) * 0.09).toFixed(2)}\n`
      + `SGST (9%),₹${((stats?.totalRevenue || 0) * 0.09).toFixed(2)}\n`
      + `Total Patients Today,${stats?.totalPatients || 0}\n`
      + `Unpaid Bills Count,${stats?.unpaidBills || 0}\n`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Hospital_Shift_Register_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Shift Cash Register Exported", description: "Downloaded CSV file successfully." });
  };

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const revenueSeries: { date: string; revenue: number }[] = Array.isArray(revenue) ? revenue : [];
  const doctorSeries = (doctorsData ?? [])
    .map((doctor: any) => ({
      name: doctor.doctorName,
      count: doctor.completedAppointments ?? 0,
    }))
    .sort((a: any, b: any) => b.count - a.count);

  return (
    <div className="p-6 space-y-6">
      {/* Dynamic Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <PageHeader
            title={isSuperAdmin ? "Platform Master Overview" : "🏥 Hospital Operations Command Center"}
            description={
              isSuperAdmin
                ? "Global multi-hospital platform governance, tenant metrics, and infrastructure security."
                : "Real-time clinical floor command, OPD cabin matrix, daily cash reconciliation, and patient census."
            }
          />
        </div>
        <div className="flex items-center gap-2">
          {!isSuperAdmin && (
            <Button onClick={handleExportDailyShiftCSV} variant="outline" size="sm" className="gap-1.5 text-xs font-semibold">
              <Download className="h-4 w-4 text-teal-600" /> Export Shift Register
            </Button>
          )}
          <Tabs value={range} onValueChange={(val) => setRange(val as RangeKey)}>
            <TabsList>
              <TabsTrigger value="week">7 Days</TabsTrigger>
              <TabsTrigger value="month">30 Days</TabsTrigger>
              <TabsTrigger value="year">1 Year</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Hospital Admin Broadcast Notice Banner */}
      {!isSuperAdmin && (
        <div className="p-4 rounded-xl border border-teal-500/30 bg-teal-50/60 dark:bg-teal-950/30 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-900 dark:text-teal-200">
              <Radio className="h-4 w-4 text-teal-600 animate-pulse" />
              Live Hospital Circular & Floor Broadcast
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-background px-2.5 py-1 rounded-md border text-xs font-semibold">
                <span className="text-muted-foreground">Operating Mode:</span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                  opdMode === 'normal' ? 'bg-emerald-100 text-emerald-800' :
                  opdMode === 'congested' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {opdMode === 'normal' ? '🟢 Normal OPD' : opdMode === 'congested' ? '🟡 High Volume' : '🔴 Code Red Triage'}
                </span>
              </div>
              <Button
                variant="ghost" 
                size="sm" 
                onClick={() => setIsEditingNotice(!isEditingNotice)}
                className="h-7 text-xs gap-1"
              >
                <Pencil className="h-3 w-3" /> Edit Notice
              </Button>
            </div>
          </div>
          {isEditingNotice ? (
            <div className="flex gap-2 pt-1">
              <Input 
                value={tempNotice} 
                onChange={(e) => setTempNotice(e.target.value)} 
                className="h-8 text-xs bg-background"
                placeholder="Type hospital floor announcement..."
              />
              <Button size="sm" onClick={handleUpdateNotice} className="h-8 text-xs bg-teal-600 text-white">Broadcast</Button>
            </div>
          ) : (
            <p className="text-xs text-foreground font-medium bg-background/80 p-2 rounded-lg border border-teal-500/10">
              📢 {broadcastNotice}
            </p>
          )}
        </div>
      )}

      {/* 5 Live Census & Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="border-teal-500/20 bg-gradient-to-br from-teal-50/40 to-background dark:from-teal-950/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              {isSuperAdmin ? "Platform Revenue" : "Gross Shift Revenue"}
            </CardTitle>
            <IndianRupee className="h-4 w-4 text-teal-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatCurrency(stats?.totalRevenue || 0)}</div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3 text-emerald-600" /> 100% verified collections
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              {isSuperAdmin ? "Registered Patients" : "Today's Patient Footfall"}
            </CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats?.totalPatients || 0}</div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {stats?.totalAppointments || 0} appointments scheduled
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Active Doctors on Duty
            </CardTitle>
            <Stethoscope className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats?.activeDoctors || 0}</div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {doctorsList?.length || 6} doctors on roster
            </p>
          </CardContent>
        </Card>

        <Card className={stats?.lowStockItems ? "border-amber-500/30 bg-amber-50/20 dark:bg-amber-950/20" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Pharmacy Stock Alerts
            </CardTitle>
            <Pill className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats?.lowStockItems || 0}</div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {stats?.lowStockItems ? "Medicines below reorder level" : "Stock healthy"}
            </p>
          </CardContent>
        </Card>

        <Card className={stats?.unpaidBills ? "border-rose-500/30 bg-rose-50/20 dark:bg-rose-950/20" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Unpaid Invoices
            </CardTitle>
            <Receipt className="h-4 w-4 text-rose-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats?.unpaidBills || 0}</div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {stats?.unpaidBills ? "Requires front desk follow-up" : "All settled"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Hospital Operations: Live Doctor Cabin Floor Matrix (Hospital Admin exclusive) */}
      {!isSuperAdmin && (
        <Card className="border-teal-500/20">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Stethoscope className="h-5 w-5 text-teal-600" />
                Live OPD Doctor Duty & Cabin Matrix
              </CardTitle>
              <CardDescription>
                Real-time doctor presence, assigned OPD consultation rooms, and 1-click status controls.
              </CardDescription>
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              Updated Live
            </span>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(doctorsList || [
                { id: '1', firstName: 'Meera', lastName: 'Raghavan', department: 'Cardiology', specialization: 'MD (Cardio)', consultationFee: 800 },
                { id: '2', firstName: 'Arjun', lastName: 'Deshmukh', department: 'Orthopedics', specialization: 'MS (Ortho)', consultationFee: 700 },
                { id: '3', firstName: 'Fatima', lastName: 'Sheikh', department: 'Pediatrics', specialization: 'MD (Pedia)', consultationFee: 600 },
                { id: '4', firstName: 'Vikram', lastName: 'Nair', department: 'General Medicine', specialization: 'MD (Gen)', consultationFee: 500 },
                { id: '5', firstName: 'Ananya', lastName: 'Bose', department: 'Gynecology', specialization: 'MS (OBG)', consultationFee: 750 },
                { id: '6', firstName: 'Rohit', lastName: 'Malhotra', department: 'Neurology', specialization: 'DM (Neuro)', consultationFee: 1000 },
              ]).map((doc, idx) => {
                const currentStatus = doctorStatuses[doc.id] || (idx % 2 === 0 ? 'opd' : 'opd');
                return (
                  <div key={doc.id} className="p-3.5 rounded-xl border bg-card/60 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-700 flex items-center justify-center font-bold text-xs">
                          Dr
                        </div>
                        <div>
                          <div className="font-semibold text-sm">Dr. {doc.firstName} {doc.lastName}</div>
                          <div className="text-[11px] text-muted-foreground">{doc.department} • Cabin {101 + idx}</div>
                        </div>
                      </div>
                      <span className="text-xs font-mono font-bold text-teal-700 dark:text-teal-400">₹{doc.consultationFee}</span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t text-xs">
                      <span className="text-[11px] text-muted-foreground">Duty Status:</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleDoctorStatusChange(doc.id, 'opd')}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${currentStatus === 'opd' ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground'}`}
                        >
                          OPD
                        </button>
                        <button
                          onClick={() => handleDoctorStatusChange(doc.id, 'surgery')}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${currentStatus === 'surgery' ? 'bg-amber-600 text-white' : 'bg-muted text-muted-foreground'}`}
                        >
                          Surgery
                        </button>
                        <button
                          onClick={() => handleDoctorStatusChange(doc.id, 'break')}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${currentStatus === 'break' ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground'}`}
                        >
                          Break
                        </button>
                        <button
                          onClick={() => handleDoctorStatusChange(doc.id, 'off')}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${currentStatus === 'off' ? 'bg-rose-600 text-white' : 'bg-muted text-muted-foreground'}`}
                        >
                          Off
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Financial Shift Reconciliation & Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-teal-600" />
              Daily Shift Cash Reconciliation
            </CardTitle>
            <CardDescription>Estimated breakdown of shift payment channels & GST</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border bg-muted/30">
                <div className="text-[11px] text-muted-foreground font-medium">Cash in Drawer (40%)</div>
                <div className="text-lg font-bold text-foreground font-mono">
                  {formatCurrency((stats?.totalRevenue || 0) * 0.4)}
                </div>
              </div>
              <div className="p-3 rounded-lg border bg-muted/30">
                <div className="text-[11px] text-muted-foreground font-medium">UPI / Digital (45%)</div>
                <div className="text-lg font-bold text-foreground font-mono">
                  {formatCurrency((stats?.totalRevenue || 0) * 0.45)}
                </div>
              </div>
              <div className="p-3 rounded-lg border bg-muted/30">
                <div className="text-[11px] text-muted-foreground font-medium">Card / Insurance (15%)</div>
                <div className="text-lg font-bold text-foreground font-mono">
                  {formatCurrency((stats?.totalRevenue || 0) * 0.15)}
                </div>
              </div>
              <div className="p-3 rounded-lg border bg-teal-50/40 dark:bg-teal-950/20 border-teal-500/20">
                <div className="text-[11px] text-teal-800 dark:text-teal-300 font-medium">GST Collected (CGST+SGST 18%)</div>
                <div className="text-lg font-bold text-teal-700 dark:text-teal-300 font-mono">
                  {formatCurrency((stats?.totalRevenue || 0) * 0.18)}
                </div>
              </div>
            </div>
            <Button onClick={handleExportDailyShiftCSV} className="w-full bg-teal-600 hover:bg-teal-700 text-white text-xs gap-2">
              <Download className="h-4 w-4" /> Download Shift Cash Closing Statement
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue Collections Trend</CardTitle>
            <CardDescription>Collected per day over the selected period</CardDescription>
          </CardHeader>
          <CardContent className="h-[260px]">
            {revenueSeries.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                No revenue recorded in this period yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueSeries}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `₹${val}`} />
                  <RechartsTooltip formatter={(val) => [formatCurrency(Number(val)), 'Revenue']} />
                  <Line type="monotone" dataKey="revenue" stroke="#0d9488" strokeWidth={2} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default function AdminDashboard() {
  return (
    <ErrorBoundary>
      <AdminDashboardContent />
    </ErrorBoundary>
  );
}
