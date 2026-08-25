import { useMemo, useState } from 'react';
import { format, subDays, subMonths } from 'date-fns';
import {
  Activity,
  AlertTriangle,
  Calendar,
  IndianRupee,
  Receipt,
  UserX,
  Users,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { PageHeader } from '@/components/shared/PageHeader';
import { formatCurrency } from '@/lib/utils';

const COLORS = ['#0d9488', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#14b8a6'];

/** How far back each tab looks. */
const RANGES = {
  week: () => subDays(new Date(), 7),
  month: () => subMonths(new Date(), 1),
  year: () => subMonths(new Date(), 12),
} as const;

type RangeKey = keyof typeof RANGES;

const AdminDashboardContent = () => {
  const [range, setRange] = useState<RangeKey>('week');

  const dates = useMemo(
    () => ({
      startDate: format(RANGES[range](), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd'),
    }),
    [range]
  );

  const { data: stats, isLoading } = useAdminDashboard();
  const { data: revenue } = useRevenueReport(dates);
  const { data: doctors } = useDoctorPerformance(dates);
  const { data: noShow } = useNoShowRates(dates);

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Everything below comes from the API. Charts show an explicit empty state
  // rather than placeholder numbers when there is nothing to plot yet.
  // /reports/revenue returns the daily series directly as an array.
  const revenueSeries: { date: string; revenue: number }[] = Array.isArray(revenue) ? revenue : [];
  const doctorSeries = (doctors ?? [])
    .map((doctor: any) => ({
      name: doctor.doctorName,
      count: doctor.completedAppointments ?? 0,
    }))
    .sort((a: any, b: any) => b.count - a.count)
    .slice(0, 6);
  const statusSeries = (noShow ?? []).map((row: any) => ({
    name: String(row.status ?? '').replace('_', ' '),
    value: row.count ?? 0,
  }));

  const tiles = [
    {
      label: 'Revenue this month',
      value: formatCurrency(stats?.totalRevenue ?? 0),
      icon: IndianRupee,
      hint: 'Paid bills only',
    },
    {
      label: 'Registered patients',
      value: (stats?.totalPatients ?? 0).toLocaleString('en-IN'),
      icon: Users,
      hint: 'Across this clinic',
    },
    {
      label: "Today's appointments",
      value: stats?.totalAppointments ?? 0,
      icon: Calendar,
      hint: `${stats?.noShowRate ?? 0}% no-show rate today`,
    },
    {
      label: 'Doctors available',
      value: stats?.activeDoctors ?? 0,
      icon: Activity,
      hint: 'Marked available right now',
    },
    {
      label: 'Items low on stock',
      value: stats?.lowStockItems ?? 0,
      icon: AlertTriangle,
      hint: 'At or below reorder level',
      warn: (stats?.lowStockItems ?? 0) > 0,
    },
    {
      label: 'Unpaid bills',
      value: stats?.unpaidBills ?? 0,
      icon: Receipt,
      hint: 'Awaiting settlement',
      warn: (stats?.unpaidBills ?? 0) > 0,
    },
  ];

  const emptyState = (message: string) => (
    <div className="flex h-full items-center justify-center text-sm text-stone-500">{message}</div>
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <PageHeader title="Admin Dashboard" description="Live figures for this clinic." />
        <Tabs value={range} onValueChange={(value) => setRange(value as RangeKey)} className="w-[300px]">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="week">Last 7 days</TabsTrigger>
            <TabsTrigger value="month">Last month</TabsTrigger>
            <TabsTrigger value="year">Last year</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <Card key={tile.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{tile.label}</CardTitle>
                <Icon
                  className={`h-4 w-4 ${tile.warn ? 'text-amber-500' : 'text-muted-foreground'}`}
                />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{tile.value}</div>
                <p className="text-xs text-muted-foreground">{tile.hint}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue</CardTitle>
            <CardDescription>Collected per day over the selected period</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {revenueSeries.length === 0 ? (
              emptyState('No payments recorded in this period yet.')
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueSeries}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `₹${value}`} />
                  <RechartsTooltip
                    formatter={(value) => [formatCurrency(Number(value)), 'Revenue']}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#0d9488"
                    strokeWidth={2}
                    activeDot={{ r: 8 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Consultations by doctor</CardTitle>
            <CardDescription>Completed appointments in the selected period</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {doctorSeries.length === 0 ? (
              emptyState('No completed consultations in this period yet.')
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={doctorSeries}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={140} />
                  <RechartsTooltip cursor={{ fill: 'transparent' }} />
                  <Bar dataKey="count" fill="#0d9488" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserX className="h-4 w-4" /> Appointment outcomes
            </CardTitle>
            <CardDescription>
              How appointments ended — completed, cancelled or missed
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {statusSeries.length === 0 ? (
              emptyState('No appointments in this period yet.')
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusSeries}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {statusSeries.map((_entry: unknown, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend />
                </PieChart>
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
