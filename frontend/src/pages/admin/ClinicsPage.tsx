import React, { useState } from 'react';
import { useClinics, useCreateClinic, useUpdateClinic } from '@/api/clinics';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/PageHeader';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Edit2, Settings } from 'lucide-react';
import { Clinic } from '@/types';

const ClinicsPageContent = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [editingClinic, setEditingClinic] = useState<Clinic | null>(null);
  
  const { data: clinics, isLoading } = useClinics();
  const { mutateAsync: createClinic, isPending: isCreating } = useCreateClinic();
  const { mutateAsync: updateClinic, isPending: isUpdating } = useUpdateClinic();
  const { toast } = useToast();

  const handleOpenEdit = (clinic: Clinic) => {
    setEditingClinic(clinic);
    setIsOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingClinic(null);
    setIsOpen(true);
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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
      workingHours: {} // Simplified for now
    };

    try {
      if (editingClinic) {
        await updateClinic({ id: editingClinic.id, ...data });
        toast({ title: "Clinic Updated", variant: "success" });
      } else {
        await createClinic(data);
        toast({ title: "Clinic Created", variant: "success" });
      }
      setIsOpen(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const columns = [
    { key: 'name', title: 'Clinic Name', render: (val: string) => <span className="font-medium">{val}</span> },
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
        <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(row)}>
          <Edit2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm">
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    ) }
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <PageHeader title="Clinics Management" description="Manage clinic branches and settings." />
        <Button onClick={handleOpenCreate}>
          <Plus className="mr-2 h-4 w-4" /> Add Clinic
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={clinics || []}
        isLoading={isLoading}
        page={1}
        pageSize={100}
        total={clinics?.length || 0}
        onPageChange={() => {}}
      />

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingClinic ? 'Edit Clinic' : 'Create New Clinic'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4 pt-4">
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
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input id="timezone" name="timezone" defaultValue={editingClinic?.timezone || 'Asia/Kolkata'} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Full Address *</Label>
              <Input id="address" name="address" defaultValue={editingClinic?.address} required />
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isCreating || isUpdating}>
                {isCreating || isUpdating ? 'Saving...' : 'Save Clinic'}
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
