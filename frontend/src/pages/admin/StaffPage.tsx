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
import { Plus, Edit2, Users, Sparkles, Wand2, Copy, Check, ShieldCheck } from 'lucide-react';

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
      toast({ title: "Failed to create", description: err.response?.data?.detail || err.message || "Error occurred", variant: "destructive" });
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
      toast({ title: "Failed to update", description: err.response?.data?.detail || err.message || "Error occurred", variant: "destructive" });
    }
  });

  const handleOpenCreate = () => {
    setEditingStaff(null);
    setFirstName('');
    setLastName('');
    setRole('receptionist');
    setGeneratedEmail('');
    setGeneratedPassword(`Staff@${Math.floor(1000 + Math.random() * 9000)}`);
    setIsOpen(true);
  };

  const handleOpenEdit = (staff: any) => {
    setEditingStaff(staff);
    setFirstName(staff.firstName || '');
    setLastName(staff.lastName || '');
    setRole(staff.role || 'receptionist');
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
    const email = l ? `${f}.${l}@sanjeevanihospital.in` : `${f}.${role.toLowerCase()}@sanjeevanihospital.in`;
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
    const formData = new FormData(e.currentTarget);
    const payload = {
      firstName: (formData.get('firstName') as string)?.trim(),
      lastName: (formData.get('lastName') as string)?.trim(),
      email: generatedEmail || (formData.get('email') as string),
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

  const columns = [
    { key: 'name', title: 'Staff Member', render: (_: any, row: any) => (
      <div className="flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-700 flex items-center justify-center font-bold text-xs">
          {row.firstName?.charAt(0) || 'U'}
        </div>
        <div>
          <div className="font-semibold text-foreground">{row.firstName} {row.lastName}</div>
          <div className="text-[11px] text-muted-foreground font-mono">{row.email}</div>
        </div>
      </div>
    ) },
    { key: 'phone', title: 'Phone Number' },
    { key: 'role', title: 'Department Role', render: (val: string) => (
      <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300">
        {val?.replace('_', ' ')}
      </span>
    ) },
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
        <Button onClick={handleOpenCreate} className="bg-teal-600 hover:bg-teal-700 text-white gap-2">
          <Plus className="h-4 w-4" /> Add Staff Member
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="ALL">All Staff</TabsTrigger>
          <TabsTrigger value="receptionist">Receptionists</TabsTrigger>
          <TabsTrigger value="pharmacist">Pharmacists</TabsTrigger>
          <TabsTrigger value="lab_technician">Lab Technicians</TabsTrigger>
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
              {editingStaff ? 'Edit Staff Profile' : 'Add New Staff & Auto-Generate Email'}
            </DialogTitle>
            <DialogDescription>
              Hospital login credentials and permissions will be configured automatically.
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
                  onChange={(e) => {
                    setFirstName(e.target.value);
                    if (!editingStaff) {
                      const f = e.target.value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
                      const l = lastName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
                      if (f) setGeneratedEmail(l ? `${f}.${l}@sanjeevanihospital.in` : `${f}.${role.toLowerCase()}@sanjeevanihospital.in`);
                    }
                  }}
                  placeholder="e.g. Priya"
                  required 
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input 
                  id="lastName" 
                  name="lastName" 
                  value={lastName}
                  onChange={(e) => {
                    setLastName(e.target.value);
                    if (!editingStaff) {
                      const f = firstName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
                      const l = e.target.value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
                      if (f) setGeneratedEmail(l ? `${f}.${l}@sanjeevanihospital.in` : `${f}.${role.toLowerCase()}@sanjeevanihospital.in`);
                    }
                  }}
                  placeholder="e.g. Menon"
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
                onChange={(e) => {
                  setRole(e.target.value);
                  if (!editingStaff && firstName) {
                    const f = firstName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
                    const l = lastName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
                    setGeneratedEmail(l ? `${f}.${l}@sanjeevanihospital.in` : `${f}.${e.target.value.toLowerCase()}@sanjeevanihospital.in`);
                  }
                }}
                className="w-full h-10 px-3 border rounded-md bg-background text-sm"
                required
              >
                <option value="receptionist">Receptionist (Front Desk, Tokens & Billing)</option>
                <option value="pharmacist">Pharmacist (Medicine Inventory & Dispensing)</option>
                <option value="lab_technician">Lab Technician (Diagnostics & Test Results)</option>
                <option value="nurse">Nurse (Patient Vitals & Care)</option>
                <option value="clinic_admin">Clinic Administrator (Full Hospital Access)</option>
              </select>
            </div>

            {/* Auto Generated Email Box */}
            <div className="space-y-1.5 p-3 rounded-lg bg-teal-50/50 dark:bg-teal-950/30 border border-teal-500/20">
              <div className="flex items-center justify-between">
                <Label htmlFor="email" className="text-xs font-bold text-teal-900 dark:text-teal-200 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-teal-600" />
                  Official Hospital Login Email
                </Label>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleAutoGenerateEmail}
                  className="h-6 text-[11px] text-teal-700 dark:text-teal-300 hover:bg-teal-100/50 px-2 gap-1"
                >
                  <Wand2 className="h-3 w-3" /> Re-Generate
                </Button>
              </div>
              <Input 
                id="email" 
                name="email" 
                type="email" 
                value={generatedEmail}
                onChange={(e) => setGeneratedEmail(e.target.value)}
                placeholder="priya.menon@sanjeevanihospital.in" 
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
                <Label htmlFor="password">Login Password</Label>
                <div className="flex gap-1.5">
                  <Input 
                    id="password" 
                    name="password" 
                    value={generatedPassword}
                    onChange={(e) => setGeneratedPassword(e.target.value)}
                    className="font-mono text-xs h-9"
                  />
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
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="bg-teal-600 hover:bg-teal-700 text-white">
                {createMutation.isPending || updateMutation.isPending ? 'Saving...' : (editingStaff ? 'Update Staff' : 'Save & Provision Staff')}
              </Button>
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
