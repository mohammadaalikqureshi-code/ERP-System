import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './client';

export interface Branch {
  id: string;
  clinicId: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  isMainBranch: boolean;
  isActive: boolean;
}

export const useBranches = () => {
  return useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const { data } = await api.get<Branch[]>('/branches');
      return data;
    },
  });
};

export const useCreateBranch = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (branchData: {
      clinic_id: string;
      name: string;
      address?: string;
      phone?: string;
      email?: string;
      is_main_branch?: boolean;
    }) => {
      const { data } = await api.post<Branch>('/branches', branchData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
  });
};

export const useUpdateBranch = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Branch> }) => {
      const { data: res } = await api.patch<Branch>(`/branches/${id}`, data);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
  });
};

export const useDeleteBranch = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/branches/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
  });
};
