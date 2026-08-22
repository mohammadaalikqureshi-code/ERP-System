import { useState } from 'react';
import { useRevenueReport, useDoctorPerformance, useNoShowRates } from '@/api/reports';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, subDays } from 'date-fns';
import { formatCurrency } from '@/lib/utils';

const COLORS = ['#0d9488', '#f59e0b', '#8b5cf6', '#ef4444', '#10b981', '#6b7280'];

const ReportsPageContent = () => {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [dateRange, setDateRange] = useState('30'); // days

  const startDate = format(subDays(new Date(), parseInt(dateRange)), 'yyyy-MM-dd');
  const endDate = format(new Date(), 'yyyy-MM-dd');

  const { data: revenueData, isLoading: loadingRevenue } = useRevenueReport({ startDate, endDate, period });
  const { data: performanceData, isLoading: loadingPerformance } = useDoctorPerformance({ startDate, endDate });
  const { data: noShowData, isLoading: loadingNoShow } = useNoShowRates({ startDate, endDate });

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <PageHeader title="Clinic Reports & Analytics" description="View financial and operational performance." />
        <div className="flex gap-4">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 Days</SelectItem>
              <SelectItem value="30">Last 30 Days</SelectItem>
              <SelectItem value="90">Last 3 Months</SelectItem>
              <SelectItem value="365">Last Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="revenue">Financial</TabsTrigger>
          <TabsTrigger value="performance">Doctor Performance</TabsTrigger>
          <TabsTrigger value="operational">Operational</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ₹{revenueData?.reduce((acc: number, curr: any) => acc + curr.revenue, 0)?.toLocaleString() || 0}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Consultations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {revenueData?.reduce((acc: number, curr: any) => acc + curr.consultations, 0) || 0}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="col-span-4">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Revenue Over Time</CardTitle>
                <CardDescription>View your revenue trends.</CardDescription>
              </div>
              <Select value={period} onValueChange={(val: any) => setPeriod(val)}>
                <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="h-[400px]">
              {loadingRevenue ? (
                <div className="h-full flex items-center justify-center">Loading...</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueData || []} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" tickFormatter={(value) => `₹${value}`} />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip formatter={(value, name) => [name === 'revenue' ? formatCurrency(Number(value)) : String(value), name === 'revenue' ? 'Revenue' : 'Consultations']} />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#0d9488" strokeWidth={2} activeDot={{ r: 8 }} name="Revenue" />
                    <Line yAxisId="right" type="monotone" dataKey="consultations" stroke="#8b5cf6" strokeWidth={2} name="Consultations" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Doctor Performance Comparison</CardTitle>
              <CardDescription>Compare completed appointments and revenue by doctor.</CardDescription>
            </CardHeader>
            <CardContent className="h-[450px]">
              {loadingPerformance ? (
                <div className="h-full flex items-center justify-center">Loading...</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={performanceData || []} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="doctorName" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={(val) => `₹${val}`} />
                    <Tooltip formatter={(value, name) => [name === 'revenueGenerated' ? formatCurrency(Number(value)) : String(value), name === 'revenueGenerated' ? 'Revenue' : 'Appointments']} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="completedAppointments" fill="#3b82f6" name="Completed Appointments" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="right" dataKey="revenueGenerated" fill="#10b981" name="Revenue Generated" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operational" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Appointment Status Distribution</CardTitle>
                <CardDescription>Breakdown of completed vs no-show vs cancelled.</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                {loadingNoShow ? (
                  <div className="h-full flex items-center justify-center">Loading...</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={noShowData || []}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="count"
                        nameKey="status"
                        label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                      >
                        {(noShowData || []).map((_entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value, name, item) => [`${value} (${Number(item?.payload?.percentage ?? 0).toFixed(1)}%)`, String(name)]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default function ReportsPage() {
  return (
    <ErrorBoundary>
      <ReportsPageContent />
    </ErrorBoundary>
  );
}
