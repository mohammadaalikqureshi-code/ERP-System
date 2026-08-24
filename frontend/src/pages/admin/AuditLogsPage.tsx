import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { Shield, Search, Download, Filter, User, Activity, Clock } from 'lucide-react';

const AuditLogsContent = () => {
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('ALL');

  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit'],
    queryFn: async () => {
      const res = await api.get('/audit');
      return res.data;
    }
  });

  const getActionBadge = (action: string) => {
    if (action.includes('LOGIN') || action.includes('AUTH')) {
      return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300">{action}</span>;
    }
    if (action.includes('PRESCRIPTION') || action.includes('CONSULTATION')) {
      return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300">{action}</span>;
    }
    if (action.includes('LAB')) {
      return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">{action}</span>;
    }
    if (action.includes('BILL') || action.includes('PAYMENT')) {
      return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">{action}</span>;
    }
    if (action.includes('PATIENT')) {
      return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-teal-100 text-teal-800 dark:bg-teal-950/50 dark:text-teal-300">{action}</span>;
    }
    return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-stone-100 text-stone-800 dark:bg-stone-800 dark:text-stone-300">{action}</span>;
  };

  const filteredItems = logs?.items?.filter((l: any) => {
    const matchesSearch = 
      l.action?.toLowerCase().includes(search.toLowerCase()) ||
      l.entityType?.toLowerCase().includes(search.toLowerCase()) ||
      l.ipAddress?.toLowerCase().includes(search.toLowerCase()) ||
      l.userId?.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;
    if (entityFilter !== 'ALL' && l.entityType !== entityFilter) return false;
    return true;
  });

  const exportCSV = () => {
    if (!logs?.items?.length) return;
    const headers = ["Timestamp", "User ID", "Action", "Entity Type", "IP Address", "Details"];
    const rows = logs.items.map((l: any) => [
      new Date(l.createdAt).toISOString(),
      l.userId,
      l.action,
      l.entityType,
      l.ipAddress || '',
      JSON.stringify(l.newValue || l.oldValue || '').replace(/"/g, '""')
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r: any) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `audit_log_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <PageHeader 
          title="Audit Logs & Compliance" 
          description="Tamper-evident chronological trail of all clinical, financial, and security activities in compliance with medical data regulations (DISHA / HIPAA)." 
        />
        <Button variant="outline" onClick={exportCSV} disabled={!logs?.items?.length} className="gap-2">
          <Download className="h-4 w-4" /> Export CSV Report
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-teal-600" />
                Security & Activity Log ({filteredItems?.length || 0} events)
              </CardTitle>
              <CardDescription>Track every action taken by doctors, front desk, and administrators.</CardDescription>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search actions or staff..."
                  className="pl-8 h-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Categories</SelectItem>
                  <SelectItem value="Auth">Security & Login</SelectItem>
                  <SelectItem value="Patient">Patient Records</SelectItem>
                  <SelectItem value="EMR">Consultations</SelectItem>
                  <SelectItem value="Prescription">Prescriptions</SelectItem>
                  <SelectItem value="Lab">Diagnostic Lab</SelectItem>
                  <SelectItem value="Billing">Billing & GST</SelectItem>
                  <SelectItem value="Inventory">Inventory</SelectItem>
                  <SelectItem value="Settings">Settings</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading audit trail...</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Staff User ID</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead className="text-right">IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No audit records match the selected filter.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredItems?.map((l: any) => (
                      <TableRow key={l.id} className="hover:bg-muted/40">
                        <TableCell className="text-xs whitespace-nowrap">
                          <div className="font-medium text-foreground">{new Date(l.createdAt).toLocaleDateString()}</div>
                          <div className="text-muted-foreground">{new Date(l.createdAt).toLocaleTimeString()}</div>
                        </TableCell>
                        <TableCell>
                          {getActionBadge(l.action)}
                        </TableCell>
                        <TableCell className="text-xs font-medium">
                          {l.entityType}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {l.userId?.substring(0, 8)}...
                        </TableCell>
                        <TableCell className="text-xs font-mono text-stone-600 dark:text-stone-300 max-w-xs truncate">
                          {l.newValue ? JSON.stringify(l.newValue) : '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                          {l.ipAddress || '127.0.0.1'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default function AuditLogsPage() {
  return (
    <ErrorBoundary>
      <AuditLogsContent />
    </ErrorBoundary>
  );
}
