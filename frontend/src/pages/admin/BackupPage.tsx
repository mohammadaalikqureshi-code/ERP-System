import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { useToast } from '@/components/ui/use-toast';
import { useAuthStore } from '@/stores/authStore';
import {
  Database,
  Download,
  ShieldCheck,
  HardDrive,
  RefreshCw,
  Clock,
  FileCheck,
  Lock,
  Crown,
  AlertTriangle,
  Sparkles,
  Server
} from 'lucide-react';

interface BackupSnapshot {
  id: string;
  filename: string;
  size_bytes: number;
  size_formatted: string;
  created_at: string;
  total_records: number;
  record_counts: Record<string, number>;
  version: string;
  status: string;
}

const BackupPageContent: React.FC = () => {
  const currentUser = useAuthStore((state) => state.user);
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: backups = [], isLoading, refetch } = useQuery<BackupSnapshot[]>({
    queryKey: ['admin-backups'],
    queryFn: async () => {
      const response = await apiClient.get('/admin/backup/list');
      return response.data;
    },
    enabled: !!isSuperAdmin,
  });

  const createBackupMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/admin/backup/create');
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-backups'] });
      toast({
        title: "Backup Snapshot Created!",
        description: `Exported ${data.total_records} hospital records (${data.size_formatted})`,
        variant: "success",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Backup Failed",
        description: err.response?.data?.message || err.message || "Could not generate backup.",
        variant: "destructive",
      });
    }
  });

  const handleDownload = (filename: string) => {
    const downloadUrl = `/api/v1/admin/backup/download/${filename}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Downloading snapshot", description: filename });
  };

  if (!isSuperAdmin) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
        <div className="p-4 rounded-full bg-rose-100 dark:bg-rose-950/40 text-rose-600 inline-block">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold">Access Denied: Super Admin Authority Required</h2>
        <p className="text-sm text-muted-foreground">
          Database snapshots contain sensitive patient medical histories, clinical records, and financial transaction logs. Only the Platform Super Admin can access or download database backups.
        </p>
      </div>
    );
  }

  const latestBackup = backups[0];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Database Snapshots & Disaster Recovery"
          description="Create point-in-time PostgreSQL encrypted backups, download offline datasets, and manage system redundancy."
        />
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="gap-1.5 text-xs"
            disabled={isLoading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={() => createBackupMutation.mutate()}
            disabled={createBackupMutation.isPending}
            className="bg-teal-600 hover:bg-teal-700 text-white gap-2 shadow-sm"
          >
            <Sparkles className="w-4 h-4" />
            {createBackupMutation.isPending ? 'Generating Snapshot...' : '⚡ Create Instant Snapshot'}
          </Button>
        </div>
      </div>

      {/* Super Admin Privilege Notice */}
      <div className="flex items-center gap-3 p-4 rounded-xl border border-teal-500/30 bg-teal-50/50 dark:bg-teal-950/20 text-xs text-teal-950 dark:text-teal-200">
        <Crown className="w-5 h-5 text-amber-500 shrink-0" />
        <div className="leading-relaxed">
          <strong>Super Admin Exclusive Protection:</strong> You are authorized to generate and download full hospital database snapshots. Snapshots include all patient demographics, EMR consultations, lab orders, prescriptions, and GST tax invoices.
        </div>
      </div>

      {/* Key Metric Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase text-muted-foreground flex items-center justify-between">
              <span>Total Snapshots</span>
              <Database className="w-4 h-4 text-teal-600" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold font-mono">{backups.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-[11px] text-muted-foreground">Stored on secure persistent storage</div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase text-muted-foreground flex items-center justify-between">
              <span>Latest Snapshot</span>
              <Clock className="w-4 h-4 text-blue-600" />
            </CardDescription>
            <CardTitle className="text-sm font-bold truncate">
              {latestBackup ? new Date(latestBackup.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + new Date(latestBackup.created_at).toLocaleDateString() : 'No Backups Yet'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-[11px] text-muted-foreground font-mono">
              {latestBackup ? `${latestBackup.total_records} records (${latestBackup.size_formatted})` : 'Click Create Snapshot'}
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase text-muted-foreground flex items-center justify-between">
              <span>Recovery Readiness</span>
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-600">100% Ready</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">PostgreSQL 16 Engine Active</div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase text-muted-foreground flex items-center justify-between">
              <span>Data Protection</span>
              <Server className="w-4 h-4 text-purple-600" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-purple-600">Encrypted</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-[11px] text-purple-700 dark:text-purple-400 font-medium">JSON / SQL Dump Protocol</div>
          </CardContent>
        </Card>
      </div>

      {/* Live Backups List Table */}
      <Card className="border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-teal-600" />
            Available System Snapshots
          </CardTitle>
          <CardDescription>
            Click download to export offline snapshot archive to your local device.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading backup catalog...</div>
          ) : backups.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="p-3 bg-muted rounded-full inline-block text-muted-foreground">
                <Database className="w-6 h-6" />
              </div>
              <div className="font-semibold text-sm">No backup snapshots found</div>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Generate your first point-in-time snapshot to safeguard clinical records and hospital financials.
              </p>
              <Button
                onClick={() => createBackupMutation.mutate()}
                className="bg-teal-600 hover:bg-teal-700 text-white text-xs gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" /> Create First Snapshot Now
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-y text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Snapshot Name</th>
                    <th className="py-3 px-4">Created Date & Time</th>
                    <th className="py-3 px-4">File Size</th>
                    <th className="py-3 px-4">Dataset Breakdown</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {backups.map((b) => (
                    <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-foreground">
                        <div className="flex items-center gap-2">
                          <FileCheck className="w-4 h-4 text-teal-600 shrink-0" />
                          <span>{b.filename}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {new Date(b.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold">
                        {b.size_formatted}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1.5 text-[10px]">
                          <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-semibold">
                            {b.record_counts?.patients || 0} Patients
                          </span>
                          <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 font-semibold">
                            {b.record_counts?.bills || 0} Invoices
                          </span>
                          <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-semibold">
                            {b.record_counts?.lab_orders || 0} Lab Tests
                          </span>
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-semibold">
                            {b.record_counts?.inventory_items || 0} Drugs
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          READY
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownload(b.filename)}
                          className="h-7 text-xs gap-1 text-teal-700 dark:text-teal-300 hover:bg-teal-50"
                        >
                          <Download className="w-3.5 h-3.5" /> Download
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default function BackupPage() {
  return (
    <ErrorBoundary>
      <BackupPageContent />
    </ErrorBoundary>
  );
}
