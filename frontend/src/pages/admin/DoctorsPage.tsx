import React, { useState } from 'react';
import { useDoctors, useCreateDoctor, useUpdateDoctor } from '@/api/doctors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/PageHeader';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Edit2, Calendar } from 'lucide-react';
import { Doctor } from '@/types';

const DoctorsPageContent = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  
  const { data: doctors, isLoading } = useDoctors();
  const { mutateAsync: createDoctor, isPending: isCreating } = useCreateDoctor();
  const { mutateAsync: updateDoctor, isPending: isUpdating } = useUpdateDoctor();
  const { toast } = useToast();

  const handleOpenEdit = (doctor: Doctor) => {
    setEditingDoctor(doctor);
    setIsOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingDoctor(null);
    setIsOpen(true);
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
    const formData = new FormData(e.currentTarget);
    const data = {
      firstName: formData.get('firstName') as string,
      lastName: formData.get('lastName') as string,
      specialization: formData.get('specialization') as string,
      department: formData.get('department') as string,
      consultationFee: Number(formData.get('consultationFee')),
      userId: formData.get('userId') as string || 'default-user-id', // Stub for user creation link
    };

    try {
      if (editingDoctor) {
        await updateDoctor({ id: editingDoctor.id, ...data });
        toast({ title: "Doctor Updated", variant: "success" });
      } else {
        await createDoctor(data);
        toast({ title: "Doctor Created", variant: "success" });
      }
      setIsOpen(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const columns = [
    { key: 'firstName', title: 'Name', render: (_: any, row: Doctor) => <span className="font-medium">Dr. {row.firstName} {row.lastName}</span> },
    { key: 'specialization', title: 'Specialization' },
    { key: 'department', title: 'Department' },
    { key: 'consultationFee', title: 'Fee', render: (val: number) => `₹${val}` },
    { key: 'isActive', title: 'Status', render: (val: boolean, row: Doctor) => (
      <button 
        onClick={() => handleToggleStatus(row)}
        className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${val ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
      >
        {val ? 'Available' : 'Unavailable'}
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
        <PageHeader title="Doctors Management" description="Manage doctors, their profiles, and fees." />
        <Button onClick={handleOpenCreate}>
          <Plus className="mr-2 h-4 w-4" /> Add Doctor
        </Button>
      </div>

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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDoctor ? 'Edit Doctor Profile' : 'Add New Doctor'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input id="firstName" name="firstName" defaultValue={editingDoctor?.firstName} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input id="lastName" name="lastName" defaultValue={editingDoctor?.lastName} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="specialization">Specialization *</Label>
                <Input id="specialization" name="specialization" defaultValue={editingDoctor?.specialization} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Department *</Label>
                <Input id="department" name="department" defaultValue={editingDoctor?.department} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="consultationFee">Consultation Fee (₹) *</Label>
                <Input id="consultationFee" name="consultationFee" type="number" defaultValue={editingDoctor?.consultationFee} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="userId">Linked User ID</Label>
                <Input id="userId" name="userId" defaultValue={editingDoctor?.userId} placeholder="UUID" />
              </div>
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isCreating || isUpdating}>
                {isCreating || isUpdating ? 'Saving...' : 'Save Doctor'}
              </Button>
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
