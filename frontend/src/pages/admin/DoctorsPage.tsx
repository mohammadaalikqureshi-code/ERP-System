import React, { useState } from 'react';
import { useDoctors, useCreateDoctor, useUpdateDoctor } from '@/api/doctors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/PageHeader';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Edit2, Calendar, Sparkles, Wand2, Copy, Check, Stethoscope, Lock, Crown, AlertCircle } from 'lucide-react';
import { Doctor } from '@/types';
import { useAuthStore } from '@/stores/authStore';

const DoctorsPageContent = () => {
  const currentUser = useAuthStore((state) => state.user);
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const [isOpen, setIsOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  
  // Auto-generation states
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [department, setDepartment] = useState('Cardiology');
  const [generatedEmail, setGeneratedEmail] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('Doctor@2026');
  const [copied, setCopied] = useState(false);

  const { data: doctors, isLoading } = useDoctors();
  const { mutateAsync: createDoctor, isPending: isCreating } = useCreateDoctor();
  const { mutateAsync: updateDoctor, isPending: isUpdating } = useUpdateDoctor();
  const { toast } = useToast();

  const handleOpenEdit = (doctor: Doctor) => {
    setEditingDoctor(doctor);
    setFirstName(doctor.firstName || '');
    setLastName(doctor.lastName || '');
    setDepartment(doctor.department || 'Cardiology');
    setGeneratedEmail((doctor as any).email || '');
    setIsOpen(true);
  };

  const handleOpenCreate = () => {
    if (!isSuperAdmin) {
      toast({ 
        title: "Access Restricted", 
        description: "Only Platform Super Admin has the authority to provision doctor accounts and issue login credentials.", 
        variant: "destructive" 
      });
      return;
    }
    setEditingDoctor(null);
    setFirstName('');
    setLastName('');
    setDepartment('Cardiology');
    setGeneratedEmail('');
    setGeneratedPassword(`Doc@${Math.floor(1000 + Math.random() * 9000)}`);
    setIsOpen(true);
  };

  const handleAutoGenerateEmail = () => {
    const f = firstName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const l = lastName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!f) {
      toast({ title: "Please enter First Name first", variant: "destructive" });
      return;
    }
    const email = l ? `dr.${f}.${l}@sanjeevanihospital.in` : `dr.${f}@sanjeevanihospital.in`;
    setGeneratedEmail(email);
    toast({ title: "Official Email Generated", description: email });
  };

  const handleCopyCredentials = () => {
    navigator.clipboard.writeText(`Email: ${generatedEmail}\nPassword: ${generatedPassword}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Credentials copied to clipboard" });
  };

  const handleToggleStatus = async (doctor: Doctor) => {
    try {
      await updateDoctor({ id: doctor.id, isActive: !doctor.isActive });
      toast({ title: "Status Updated", variant: "success" });
    } catch (error: any) {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    }
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      toast({ title: "Unauthorized", description: "Only Super Admin can save credentials.", variant: "destructive" });
      return;
    }

    const formData = new FormData(e.currentTarget);
    const data = {
      firstName: (formData.get('firstName') as string)?.trim(),
      lastName: (formData.get('lastName') as string)?.trim(),
      specialization: formData.get('specialization') as string,
      department: formData.get('department') as string,
      consultationFee: Number(formData.get('consultationFee')),
      email: generatedEmail || (formData.get('email') as string),
      password: generatedPassword,
      userId: formData.get('userId') as string || 'default-user-id',
    };

    try {
      if (editingDoctor) {
        await updateDoctor({ id: editingDoctor.id, ...data });
        toast({ title: "Doctor Profile Updated", variant: "success" });
      } else {
        await createDoctor(data);
        toast({ 
          title: "New Doctor Created!", 
          description: `Login created for ${data.firstName} with email ${data.email}`, 
          variant: "success" 
        });
      }
      setIsOpen(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const columns = [
    { key: 'firstName', title: 'Doctor Name', render: (_: any, row: Doctor) => (
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-700 flex items-center justify-center font-bold text-xs">
          Dr
        </div>
        <div>
          <div className="font-semibold text-foreground">Dr. {row.firstName} {row.lastName}</div>
          <div className="text-[11px] text-muted-foreground">{(row as any).email || `${row.firstName?.toLowerCase()}@hospital.in`}</div>
        </div>
      </div>
    ) },
    { key: 'department', title: 'Department', render: (val: string) => <span className="font-medium">{val}</span> },
    { key: 'specialization', title: 'Specialization' },
    { key: 'consultationFee', title: 'OPD Fee', render: (val: number) => <span className="font-mono font-bold">₹{val}</span> },
    { key: 'isActive', title: 'Status', render: (val: boolean, row: Doctor) => (
      <button 
        onClick={() => handleToggleStatus(row)}
        className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${val ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 hover:bg-rose-200'}`}
      >
        {val ? 'Active OPD' : 'Unavailable'}
      </button>
    ) },
    { key: 'id', title: 'Actions', render: (_: any, row: Doctor) => (
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(row)}>
          <Edit2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" title="View Schedule">
          <Calendar className="h-4 w-4" />
        </Button>
      </div>
    ) }
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <PageHeader 
          title="Doctors & Specialists" 
          description="Manage doctor profiles, OPD departments, consultation fees, and automatic login email provisioning." 
        />
        {isSuperAdmin ? (
          <Button onClick={handleOpenCreate} className="bg-teal-600 hover:bg-teal-700 text-white gap-2">
            <Plus className="h-4 w-4" /> Add Doctor
          </Button>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-xs font-medium">
            <Lock className="h-3.5 w-3.5" /> Super Admin Authorization Required to Provision Doctors
          </div>
        )}
      </div>

      {/* Super Admin Privilege Notice Banner */}
      {isSuperAdmin ? (
        <div className="flex items-center gap-3 p-3.5 rounded-xl border border-teal-500/30 bg-teal-50/50 dark:bg-teal-950/20 text-xs text-teal-900 dark:text-teal-200">
          <Crown className="h-5 w-5 text-amber-500 shrink-0" />
          <div>
            <strong>Super Admin Privilege Active:</strong> You hold exclusive authority to add consulting doctors, assign OPD departments, and issue official email credentials.
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-3.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/50 text-xs text-stone-600 dark:text-stone-400">
          <AlertCircle className="h-4 w-4 text-stone-500 shrink-0" />
          <div>
            <strong>Read-Only Directory:</strong> Doctors and login credentials can only be provisioned or modified by the <strong>Super Admin</strong>.
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={doctors || []}
        isLoading={isLoading}
        page={1}
        pageSize={50}
        total={doctors?.length || 0}
        onPageChange={() => {}}
      />

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-teal-600" />
              {editingDoctor ? 'Edit Doctor Profile' : 'Super Admin: Provision New Doctor'}
            </DialogTitle>
            <DialogDescription>
              {isSuperAdmin 
                ? "Official hospital email and password will be generated and assigned exclusively by Super Admin."
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
                    if (!editingDoctor) {
                      const f = e.target.value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
                      const l = lastName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
                      if (f) setGeneratedEmail(l ? `dr.${f}.${l}@sanjeevanihospital.in` : `dr.${f}@sanjeevanihospital.in`);
                    }
                  }}
                  placeholder="e.g. Rahul"
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
                    if (!editingDoctor) {
                      const f = firstName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
                      const l = e.target.value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
                      if (f) setGeneratedEmail(l ? `dr.${f}.${l}@sanjeevanihospital.in` : `dr.${f}@sanjeevanihospital.in`);
                    }
                  }}
                  placeholder="e.g. Sharma"
                  required 
                />
              </div>
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
                placeholder="dr.rahul.sharma@sanjeevanihospital.in" 
                className="bg-background text-sm h-9 font-mono"
                required 
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="department">Department *</Label>
                <select 
                  id="department" 
                  name="department" 
                  value={department}
                  disabled={!isSuperAdmin}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full h-9 px-3 border rounded-md bg-background text-sm"
                  required
                >
                  <option value="Cardiology">Cardiology</option>
                  <option value="General Medicine">General Medicine</option>
                  <option value="Orthopedics">Orthopedics</option>
                  <option value="Pediatrics">Pediatrics</option>
                  <option value="Neurology">Neurology</option>
                  <option value="Gynecology">Gynecology</option>
                  <option value="Dermatology">Dermatology</option>
                  <option value="ENT">ENT</option>
                  <option value="Ophthalmology">Ophthalmology</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="specialization">Specialization *</Label>
                <Input 
                  id="specialization" 
                  name="specialization" 
                  defaultValue={editingDoctor?.specialization} 
                  placeholder="e.g. MD (Cardio), DM"
                  required 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="consultationFee">OPD Consultation Fee (₹) *</Label>
                <Input 
                  id="consultationFee" 
                  name="consultationFee" 
                  type="number" 
                  defaultValue={editingDoctor?.consultationFee || 500} 
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
                <Button type="submit" disabled={isCreating || isUpdating} className="bg-teal-600 hover:bg-teal-700 text-white">
                  {isCreating || isUpdating ? 'Saving...' : (editingDoctor ? 'Update Profile' : 'Save & Provision Doctor')}
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default function DoctorsPage() {
  return (
    <ErrorBoundary>
      <DoctorsPageContent />
    </ErrorBoundary>
  );
}
