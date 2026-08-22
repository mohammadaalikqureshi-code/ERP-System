import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/PageHeader';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Edit2 } from 'lucide-react';

import { useMutation, useQueryClient } from '@tanstack/react-query';

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
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: staffList, isLoading } = useStaff(activeTab !== 'ALL' ? activeTab : undefined);

  const createMutation = useMutation({
    mutationFn: (payload: any) => apiClient.post('/users/staff', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast({ title: "Staff Created", description: "New staff member added successfully.", variant: "success" });
      setIsOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Failed to create", description: err.response?.data?.detail || "Error occurred", variant: "destructive" });
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
      toast({ title: "Failed to update", description: err.response?.data?.detail || "Error occurred", variant: "destructive" });
    }
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/users/staff/${id}/toggle-status`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast({ title: "Status Updated", description: "Staff active status changed.", variant: "success" });
    }
  });

  const handleOpenEdit = (staff: any) => {
    setEditingStaff(staff);
    setIsOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingStaff(null);
    setIsOpen(true);
  };

  const handleToggleStatus = (staff: any) => {
    toggleMutation.mutate(staff.id);
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload = {
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      role: formData.get("role"),
    };
    if (editingStaff) {
      updateMutation.mutate({ id: editingStaff.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const columns = [
    { key: 'name', title: 'Name', render: (_: any, row: any) => <span className="font-medium">{row.firstName} {row.lastName}</span> },
    { key: 'email', title: 'Email' },
    { key: 'phone', title: 'Phone' },
    { key: 'role', title: 'Role', render: (val: string) => <span className="text-xs bg-muted px-2 py-1 rounded font-medium">{val}</span> },
    { key: 'isActive', title: 'Status', render: (val: boolean, row: any) => (
      <button 
        onClick={() => handleToggleStatus(row)}
        className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${val ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
      >
        {val ? 'Active' : 'Inactive'}
      </button>
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
        <PageHeader title="Staff Management" description="Manage receptionists, nurses, and other staff members." />
        <Button onClick={handleOpenCreate}>
          <Plus className="mr-2 h-4 w-4" /> Add Staff
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="ALL">All Staff</TabsTrigger>
          <TabsTrigger value="RECEPTIONIST">Receptionists</TabsTrigger>
          <TabsTrigger value="NURSE">Nurses</TabsTrigger>
          <TabsTrigger value="LAB_TECH">Lab Technicians</TabsTrigger>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingStaff ? 'Edit Staff Profile' : 'Add New Staff'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input id="firstName" name="firstName" defaultValue={editingStaff?.firstName} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input id="lastName" name="lastName" defaultValue={editingStaff?.lastName} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" name="email" type="email" defaultValue={editingStaff?.email} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone *</Label>
                <Input id="phone" name="phone" defaultValue={editingStaff?.phone} required />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Role *</Label>
                <Select name="role" defaultValue={editingStaff?.role || 'RECEPTIONIST'}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RECEPTIONIST">Receptionist</SelectItem>
                    <SelectItem value="NURSE">Nurse</SelectItem>
                    <SelectItem value="LAB_TECH">Lab Technician</SelectItem>
                    <SelectItem value="PHARMACIST">Pharmacist</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button type="submit">
                Save Staff
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
