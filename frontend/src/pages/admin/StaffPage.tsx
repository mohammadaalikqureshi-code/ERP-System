import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/PageHeader';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Edit2, Users, Sparkles, Wand2, Copy, Check, ShieldCheck, Lock, Crown, AlertCircle, FlaskConical } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

const useStaff = (role?: string) => {
  return useQuery({
    queryKey: ['staff', role],
    queryFn: async () => {
      const { data } = await apiClient.get('/users/staff', { params: { role: role === 'ALL' ? undefined : role } });
      return data;
    },
  });
};

const StaffPageContent = () => {
  const currentUser = useAuthStore((state) => state.user);
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('ALL');
  const [editingStaff, setEditingStaff] = useState<any | null>(null);

  // Auto-generation states
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('receptionist');
  const [generatedEmail, setGeneratedEmail] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('Hospital@2026');
  const [copied, setCopied] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: staffList, isLoading } = useStaff(activeTab !== 'ALL' ? activeTab : undefined);

  const createMutation = useMutation({
    mutationFn: (payload: any) => apiClient.post('/users/staff', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast({ title: "Staff Member Created", description: `Account provisioned for ${generatedEmail}`, variant: "success" });
      setIsOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Authority Error", description: err.response?.data?.message || err.response?.data?.detail || "Only Super Admin has authority to create staff.", variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string, payload: any }) => apiClient.put(`/users/staff/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast({ title: "Staff Updated", description: "Staff profile updated successfully.", variant: "success" });
      setIsOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Authority Error", description: err.response?.data?.message || err.response?.data?.detail || "Only Super Admin has authority to modify credentials.", variant: "destructive" });
    }
  });

  const handleOpenCreate = () => {
    if (!isSuperAdmin) {
      toast({ 
        title: "Access Restricted", 
        description: "Only Platform Super Admin has the authority to provision staff accounts and issue login credentials.", 
        variant: "destructive" 
      });
      return;
    }
    setEditingStaff(null);
    setFirstName('');
    setLastName('');
    setRole(activeTab !== 'ALL' ? activeTab : 'receptionist');
    setGeneratedEmail('');
    setGeneratedPassword(`Staff@${Math.floor(1000 + Math.random() * 9000)}`);
    setIsOpen(true);
  };

  const handleOpenEdit = (staff: any) => {
    setEditingStaff(staff);
    setFirstName(staff.firstName || '');
    setLastName(staff.lastName || '');
    setRole(staff.role?.toLowerCase() === 'lab_technician' ? 'lab_staff' : (staff.role?.toLowerCase() || 'receptionist'));
    setGeneratedEmail(staff.email || '');
    setIsOpen(true);
  };

  const handleAutoGenerateEmail = () => {
    const f = firstName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const l = lastName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!f) {
      toast({ title: "Please enter First Name first", variant: "destructive" });
      return;
    }
    const roleSlug = role === 'lab_staff' ? 'lab' : role.toLowerCase();
    const email = l ? `${f}.${l}@sanjeevanihospital.in` : `${f}.${roleSlug}@sanjeevanihospital.in`;
    setGeneratedEmail(email);
    toast({ title: "Hospital Email Generated", description: email });
  };

  const handleCopyCredentials = () => {
    navigator.clipboard.writeText(`Email: ${generatedEmail}\nPassword: ${generatedPassword}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Credentials copied to clipboard" });
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      toast({ title: "Unauthorized", description: "Only Super Admin can save credentials.", variant: "destructive" });
      return;
    }

    const formData = new FormData(e.currentTarget);
    const payload = {
      firstName: (formData.get('firstName') as string)?.trim(),
      lastName: (formData.get('lastName') as string)?.trim(),
      email: (generatedEmail || (formData.get('email') as string))?.trim()?.toLowerCase(),
      phone: formData.get('phone') as string,
      role: role,
      password: generatedPassword,
    };

    if (editingStaff) {
      updateMutation.mutate({ id: editingStaff.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const getRoleBadge = (roleName: string) => {
    const r = roleName?.toLowerCase();
    if (r === 'lab_staff' || r === 'lab_technician') {
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-bold uppercase bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
          <FlaskConical className="h-3 w-3" /> Lab Technician
        </span>
      );
    }
    if (r === 'receptionist') {
      return <span className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300">Receptionist</span>;
    }
    if (r === 'pharmacist') {
      return <span className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">Pharmacist</span>;
    }
    if (r === 'nurse') {
      return <span className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">Nurse</span>;
    }
    if (r === 'clinic_admin') {
      return <span className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Clinic Admin</span>;
    }
    return <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase bg-muted text-muted-foreground">{roleName}</span>;
  };

  const columns = [
    { key: 'name', title: 'Staff Member', render: (_: any, row: any) => (
      <div className="flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-700 flex items-center justify-center font-bold text-xs">
          {row.firstName?.charAt(0) || row.full_name?.charAt(0) || 'U'}
        </div>
        <div>
          <div className="font-semibold text-foreground">{row.full_name || `${row.firstName} ${row.lastName}`}</div>
          <div className="text-[11px] text-muted-foreground font-mono">{row.email}</div>
        </div>
      </div>
    ) },
    { key: 'phone', title: 'Phone Number', render: (val: string) => val || '—' },
    { key: 'role', title: 'Department Role', render: (val: string) => getRoleBadge(val) },
    { key: 'isActive', title: 'Status', render: (val: boolean) => (
      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${val !== false ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-800'}`}>
        {val !== false ? 'Active' : 'Suspended'}
      </span>
    ) },
    { key: 'id', title: 'Actions', render: (_: any, row: any) => (
      <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(row)}>
        <Edit2 className="h-4 w-4" />
      </Button>
    ) }
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <PageHeader 
          title="Staff & User Accounts" 
          description="Manage receptionist, nurse, pharmacist, lab technician, and administrator logins." 
        />
        {isSuperAdmin ? (
          <Button onClick={handleOpenCreate} className="bg-teal-600 hover:bg-teal-700 text-white gap-2">
            <Plus className="h-4 w-4" /> Add Staff Member
          </Button>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-xs font-medium">
            <Lock className="h-3.5 w-3.5" /> Super Admin Authorization Required to Issue Credentials
          </div>
        )}
      </div>

      {/* Super Admin Notice Banner */}
      {isSuperAdmin ? (
        <div className="flex items-center gap-3 p-3.5 rounded-xl border border-teal-500/30 bg-teal-50/50 dark:bg-teal-950/20 text-xs text-teal-900 dark:text-teal-200">
          <Crown className="h-5 w-5 text-amber-500 shrink-0" />
          <div>
            <strong>Super Admin Privilege Active:</strong> You hold exclusive authority to provision hospital email IDs, generate secure passwords, and distribute login credentials to all department members.
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-3.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/50 text-xs text-stone-600 dark:text-stone-400">
          <AlertCircle className="h-4 w-4 text-stone-500 shrink-0" />
          <div>
            <strong>Read-Only Directory:</strong> Staff accounts and credentials can only be provisioned or modified by the <strong>Super Admin</strong>.
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="ALL">All Staff</TabsTrigger>
          <TabsTrigger value="lab_staff">Lab Technicians</TabsTrigger>
          <TabsTrigger value="receptionist">Receptionists</TabsTrigger>
          <TabsTrigger value="pharmacist">Pharmacists</TabsTrigger>
          <TabsTrigger value="nurse">Nurses</TabsTrigger>
        </TabsList>

        <DataTable
          columns={columns}
          data={staffList || []}
          isLoading={isLoading}
          page={1}
          pageSize={50}
          total={staffList?.length || 0}
          onPageChange={() => {}}
        />
      </Tabs>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-teal-600" />
              {editingStaff ? 'Edit Staff Profile' : 'Super Admin: Provision New Staff Login'}
            </DialogTitle>
            <DialogDescription>
              {isSuperAdmin 
                ? "Official email and password will be generated and assigned exclusively by Super Admin."
                : "Credential fields are locked for non-super admin users."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">First Name *</Label>
                <Input 
                  id="firstName" 
                  name="firstName" 
                  value={firstName}
                  disabled={!isSuperAdmin}
                  onChange={(e) => {
                    setFirstName(e.target.value);
                    if (!editingStaff) {
                      const f = e.target.value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
                      const l = lastName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
                      const roleSlug = role === 'lab_staff' ? 'lab' : role.toLowerCase();
                      if (f) setGeneratedEmail(l ? `${f}.${l}@sanjeevanihospital.in` : `${f}.${roleSlug}@sanjeevanihospital.in`);
                    }
                  }}
                  placeholder="e.g. Mohammad"
                  required 
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input 
                  id="lastName" 
                  name="lastName" 
                  value={lastName}
                  disabled={!isSuperAdmin}
                  onChange={(e) => {
                    setLastName(e.target.value);
                    if (!editingStaff) {
                      const f = firstName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
                      const l = e.target.value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
                      const roleSlug = role === 'lab_staff' ? 'lab' : role.toLowerCase();
                      if (f) setGeneratedEmail(l ? `${f}.${l}@sanjeevanihospital.in` : `${f}.${roleSlug}@sanjeevanihospital.in`);
                    }
                  }}
                  placeholder="e.g. Qureshi"
                  required 
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="role">Hospital Role & Access Tier *</Label>
              <select 
                id="role"
                name="role" 
                value={role}
                disabled={!isSuperAdmin}
                onChange={(e) => {
                  setRole(e.target.value);
                  if (!editingStaff && firstName) {
                    const f = firstName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
                    const l = lastName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
                    const roleSlug = e.target.value === 'lab_staff' ? 'lab' : e.target.value.toLowerCase();
                    setGeneratedEmail(l ? `${f}.${l}@sanjeevanihospital.in` : `${f}.${roleSlug}@sanjeevanihospital.in`);
                  }
                }}
                className="w-full h-10 px-3 border rounded-md bg-background text-sm"
                required
              >
                <option value="lab_staff">🧪 Lab Technician (Diagnostics, Test Catalog & Results)</option>
                <option value="receptionist">📋 Receptionist (Front Desk, Tokens & Billing)</option>
                <option value="pharmacist">💊 Pharmacist (Medicine Inventory & Dispensing)</option>
                <option value="nurse">🩺 Nurse (Patient Vitals & Care)</option>
                <option value="clinic_admin">🏥 Clinic Administrator (Full Hospital Access)</option>
              </select>
            </div>

            {/* Auto Generated Email Box */}
            <div className="space-y-1.5 p-3 rounded-lg bg-teal-50/50 dark:bg-teal-950/30 border border-teal-500/20">
              <div className="flex items-center justify-between">
                <Label htmlFor="email" className="text-xs font-bold text-teal-900 dark:text-teal-200 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-teal-600" />
                  Official Hospital Login Email (Super Admin Provisioned)
                </Label>
                {isSuperAdmin && (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleAutoGenerateEmail}
                    className="h-6 text-[11px] text-teal-700 dark:text-teal-300 hover:bg-teal-100/50 px-2 gap-1"
                  >
                    <Wand2 className="h-3 w-3" /> Re-Generate
                  </Button>
                )}
              </div>
              <Input 
                id="email" 
                name="email" 
                type="email" 
                value={generatedEmail}
                disabled={!isSuperAdmin}
                onChange={(e) => setGeneratedEmail(e.target.value)}
                placeholder="mohammad.qureshi@sanjeevanihospital.in" 
                className="bg-background text-sm h-9 font-mono"
                required 
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input 
                  id="phone" 
                  name="phone" 
                  defaultValue={editingStaff?.phone} 
                  placeholder="+91 98765 00000"
                  required 
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Login Password (Assigned by Super Admin)</Label>
                <div className="flex gap-1.5">
                  <Input 
                    id="password" 
                    name="password" 
                    value={generatedPassword}
                    disabled={!isSuperAdmin}
                    onChange={(e) => setGeneratedPassword(e.target.value)}
                    className="font-mono text-xs h-9"
                  />
                  {isSuperAdmin && (
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={handleCopyCredentials}
                      className="h-9 px-2.5"
                      title="Copy Login Credentials"
                    >
                      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
              {isSuperAdmin && (
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="bg-teal-600 hover:bg-teal-700 text-white">
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : (editingStaff ? 'Update Staff' : 'Save & Provision Staff')}
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default function StaffPage() {
  return (
    <ErrorBoundary>
      <StaffPageContent />
    </ErrorBoundary>
  );
}
