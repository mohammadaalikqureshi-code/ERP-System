import React, { useState } from 'react';
import { useClinics, useCreateClinic, useUpdateClinic } from '@/api/clinics';
import { useBranches, useCreateBranch, useUpdateBranch, useDeleteBranch, Branch } from '@/api/branches';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { DataTable } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/PageHeader';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Edit2, Trash2, Building, Building2, MapPin, Phone, Mail, CheckCircle2 } from 'lucide-react';
import { Clinic } from '@/types';
import { useAuthStore } from '@/stores/authStore';

const ClinicsPageContent = () => {
  const [activeTab, setActiveTab] = useState('branches');
  const user = useAuthStore((s) => s.user);
  const currentClinicId = user?.clinicId || '';

  // Clinic Modal
  const [isClinicOpen, setIsClinicOpen] = useState(false);
  const [editingClinic, setEditingClinic] = useState<Clinic | null>(null);

  // Branch Modal
  const [isBranchOpen, setIsBranchOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [isMainBranch, setIsMainBranch] = useState(false);

  const { data: clinics, isLoading: loadingClinics } = useClinics();
  const { mutateAsync: createClinic, isPending: isCreatingClinic } = useCreateClinic();
  const { mutateAsync: updateClinic, isPending: isUpdatingClinic } = useUpdateClinic();

  const { data: branches, isLoading: loadingBranches } = useBranches();
  const { mutateAsync: createBranch, isPending: isCreatingBranch } = useCreateBranch();
  const { mutateAsync: updateBranch, isPending: isUpdatingBranch } = useUpdateBranch();
  const { mutateAsync: deleteBranch } = useDeleteBranch();

  const { toast } = useToast();

  const handleOpenEditClinic = (clinic: Clinic) => {
    setEditingClinic(clinic);
    setIsClinicOpen(true);
  };

  const handleOpenCreateClinic = () => {
    setEditingClinic(null);
    setIsClinicOpen(true);
  };

  const handleOpenCreateBranch = () => {
    setEditingBranch(null);
    setIsMainBranch(false);
    setIsBranchOpen(true);
  };

  const handleOpenEditBranch = (branch: Branch) => {
    setEditingBranch(branch);
    setIsMainBranch(branch.isMainBranch);
    setIsBranchOpen(true);
  };

  const handleDeleteBranch = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete branch "${name}"?`)) {
      try {
        await deleteBranch(id);
        toast({ title: "Branch Deleted", variant: "success" });
      } catch (err: any) {
        toast({ title: "Error deleting branch", description: err.message, variant: "destructive" });
      }
    }
  };

  const onClinicSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      address: formData.get('address') as string,
      phone: formData.get('phone') as string,
      email: formData.get('email') as string,
      gstNumber: formData.get('gstNumber') as string,
      timezone: formData.get('timezone') as string,
      isActive: true,
      workingHours: {}
    };

    try {
      if (editingClinic) {
        await updateClinic({ id: editingClinic.id, ...data });
        toast({ title: "Clinic Updated", variant: "success" });
      } else {
        await createClinic(data);
        toast({ title: "Clinic Created", variant: "success" });
      }
      setIsClinicOpen(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const onBranchSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const clinicId = (formData.get('clinicId') as string) || currentClinicId || clinics?.[0]?.id;

    if (!clinicId) {
      toast({ title: "Error", description: "Clinic ID is required", variant: "destructive" });
      return;
    }

    const payload = {
      clinic_id: clinicId,
      name: formData.get('name') as string,
      address: formData.get('address') as string,
      phone: formData.get('phone') as string,
      email: formData.get('email') as string,
      is_main_branch: isMainBranch,
    };

    try {
      if (editingBranch) {
        await updateBranch({ id: editingBranch.id, data: payload as any });
        toast({ title: "Branch Updated", description: "Branch settings saved successfully", variant: "success" });
      } else {
        await createBranch(payload);
        toast({ title: "New Branch Added!", description: `"${payload.name}" is now active in your branch switcher.`, variant: "success" });
      }
      setIsBranchOpen(false);
    } catch (error: any) {
      toast({ title: "Error saving branch", description: error.message, variant: "destructive" });
    }
  };

  const clinicColumns = [
    { key: 'name', title: 'Clinic Name', render: (val: string) => <span className="font-semibold">{val}</span> },
    { key: 'phone', title: 'Phone' },
    { key: 'email', title: 'Email' },
    { key: 'gstNumber', title: 'GST No.' },
    { key: 'isActive', title: 'Status', render: (val: boolean) => (
      <span className={`px-2 py-1 rounded text-xs font-medium ${val ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
        {val ? 'Active' : 'Inactive'}
      </span>
    ) },
    { key: 'id', title: 'Actions', render: (_: any, row: Clinic) => (
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={() => handleOpenEditClinic(row)}>
          <Edit2 className="h-4 w-4" />
        </Button>
      </div>
    ) }
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <PageHeader 
          title="Branches & Locations" 
          description="Manage multiple hospital campuses, satellite OPD clinics, and diagnostic centers." 
        />
        <div className="flex gap-3">
          <Button onClick={handleOpenCreateBranch} className="bg-teal-600 hover:bg-teal-700 text-white">
            <Plus className="mr-2 h-4 w-4" /> Add New Branch
          </Button>
          {user?.role === 'super_admin' && (
            <Button variant="outline" onClick={handleOpenCreateClinic}>
              <Building2 className="mr-2 h-4 w-4" /> Add Clinic Tenant
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-xs">
          <TabsTrigger value="branches">Branches ({branches?.length || 0})</TabsTrigger>
          {user?.role === 'super_admin' && <TabsTrigger value="clinics">Hospitals / Clinics</TabsTrigger>}
        </TabsList>

        {/* Tab 1: Branches Grid */}
        <TabsContent value="branches" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {branches?.map((branch) => (
              <Card key={branch.id} className={`relative transition-all hover:shadow-md ${branch.isMainBranch ? 'border-teal-500/60 bg-teal-50/20 dark:bg-teal-950/20' : ''}`}>
                {branch.isMainBranch && (
                  <span className="absolute top-3 right-3 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-teal-600 text-white flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Main Campus
                  </span>
                )}
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building className="h-5 w-5 text-teal-600" />
                    {branch.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground pb-4">
                  {branch.address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-stone-400 mt-0.5 shrink-0" />
                      <span className="line-clamp-2">{branch.address}</span>
                    </div>
                  )}
                  {branch.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-stone-400 shrink-0" />
                      <span>{branch.phone}</span>
                    </div>
                  )}
                  {branch.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-stone-400 shrink-0" />
                      <span className="truncate">{branch.email}</span>
                    </div>
                  )}
                  <div className="pt-4 flex justify-end gap-2 border-t mt-4">
                    <Button variant="outline" size="sm" onClick={() => handleOpenEditBranch(branch)}>
                      <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
                    </Button>
                    {!branch.isMainBranch && (
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteBranch(branch.id, branch.name)} className="text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Add New Branch Card CTA */}
            <div 
              onClick={handleOpenCreateBranch}
              className="border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:border-teal-500 hover:bg-teal-50/10 transition-all text-muted-foreground hover:text-teal-600 min-h-[200px]"
            >
              <div className="h-12 w-12 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-600 flex items-center justify-center mb-3">
                <Plus className="h-6 w-6" />
              </div>
              <h4 className="font-semibold text-base">Add Another Branch</h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Create a satellite clinic, diagnostic center, or extension OPD facility.
              </p>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Clinics Table (SuperAdmin only) */}
        {user?.role === 'super_admin' && (
          <TabsContent value="clinics" className="space-y-4 pt-4">
            <DataTable
              columns={clinicColumns}
              data={clinics || []}
              isLoading={loadingClinics}
              page={1}
              pageSize={100}
              total={clinics?.length || 0}
              onPageChange={() => {}}
            />
          </TabsContent>
        )}
      </Tabs>

      {/* Add / Edit Branch Dialog */}
      <Dialog open={isBranchOpen} onOpenChange={setIsBranchOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building className="h-5 w-5 text-teal-600" />
              {editingBranch ? 'Edit Branch' : 'Add New Hospital Branch'}
            </DialogTitle>
            <DialogDescription>
              New branches will immediately appear in your topbar branch switcher.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onBranchSubmit} className="space-y-4 pt-2">
            {user?.role === 'super_admin' && clinics && clinics.length > 1 && (
              <div className="space-y-1.5">
                <Label>Parent Hospital / Clinic *</Label>
                <select 
                  name="clinicId" 
                  defaultValue={editingBranch?.clinicId || currentClinicId || clinics[0].id}
                  className="w-full h-10 px-3 border rounded-md bg-background text-sm"
                  required
                >
                  {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="branch-name">Branch / Location Name *</Label>
              <Input 
                id="branch-name" 
                name="name" 
                placeholder="e.g. South City Extension OPD / Rohini Diagnostics" 
                defaultValue={editingBranch?.name} 
                required 
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="branch-address">Physical Address *</Label>
              <Input 
                id="branch-address" 
                name="address" 
                placeholder="e.g. Plot 45, Sector 21, New Delhi" 
                defaultValue={editingBranch?.address} 
                required 
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="branch-phone">Phone Number</Label>
                <Input 
                  id="branch-phone" 
                  name="phone" 
                  placeholder="+91 98765 00000" 
                  defaultValue={editingBranch?.phone} 
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="branch-email">Branch Email</Label>
                <Input 
                  id="branch-email" 
                  name="email" 
                  type="email" 
                  placeholder="rohini@hospital.in" 
                  defaultValue={editingBranch?.email} 
                />
              </div>
            </div>

            <div className="flex items-center justify-between border rounded-lg p-3 bg-muted/30">
              <div>
                <Label className="font-medium cursor-pointer" htmlFor="is-main">Primary / Main Campus</Label>
                <p className="text-xs text-muted-foreground">Default location selected for staff logins.</p>
              </div>
              <Switch 
                id="is-main"
                checked={isMainBranch}
                onCheckedChange={setIsMainBranch}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsBranchOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isCreatingBranch || isUpdatingBranch} className="bg-teal-600 hover:bg-teal-700 text-white">
                {isCreatingBranch || isUpdatingBranch ? 'Saving...' : (editingBranch ? 'Update Branch' : 'Add Branch')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Clinic Modal */}
      <Dialog open={isClinicOpen} onOpenChange={setIsClinicOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingClinic ? 'Edit Clinic' : 'Create New Clinic'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onClinicSubmit} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Clinic Name *</Label>
                <Input id="name" name="name" defaultValue={editingClinic?.name} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gstNumber">GST Number</Label>
                <Input id="gstNumber" name="gstNumber" defaultValue={editingClinic?.gstNumber} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input id="phone" name="phone" defaultValue={editingClinic?.phone} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" name="email" type="email" defaultValue={editingClinic?.email} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Full Address *</Label>
              <Input id="address" name="address" defaultValue={editingClinic?.address} required />
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsClinicOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isCreatingClinic || isUpdatingClinic}>
                {isCreatingClinic || isUpdatingClinic ? 'Saving...' : 'Save Clinic'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default function ClinicsPage() {
  return (
    <ErrorBoundary>
      <ClinicsPageContent />
    </ErrorBoundary>
  );
}
