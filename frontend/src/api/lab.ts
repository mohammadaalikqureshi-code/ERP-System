import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';
import { LabTest, LabOrder } from '../types';

export const labKeys = {
  all: ['lab'] as const,
  catalog: () => [...labKeys.all, 'catalog'] as const,
  orders: (filters?: any) => [...labKeys.all, 'orders', filters] as const,
  order: (id: string) => [...labKeys.all, 'order', id] as const,
};

export const useLabCatalog = () => {
  return useQuery({
    queryKey: labKeys.catalog(),
    queryFn: async () => {
      const { data } = await apiClient.get<LabTest[]>('/lab/catalog');
      return data;
    },
  });
};

export const useLabOrders = (filters?: any) => {
  return useQuery({
    queryKey: labKeys.orders(filters),
    queryFn: async () => {
      const { data } = await apiClient.get<LabOrder[]>('/lab/orders', { params: filters });
      return data;
    },
  });
};

export const useCreateOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<LabOrder>) => {
      const { data } = await apiClient.post<LabOrder>('/lab/orders', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labKeys.orders() });
    },
  });
};

export const useSubmitResult = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, items }: { orderId: string; items: any[] }) => {
      const { data } = await apiClient.post<LabOrder>(`/lab/orders/${orderId}/results`, { items });
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: labKeys.order(variables.orderId) });
      queryClient.invalidateQueries({ queryKey: labKeys.orders() });
    },
  });
};
