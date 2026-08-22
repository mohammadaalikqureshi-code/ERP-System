import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';
import { Bill, Paginated, Payment } from '../types';

export const useBills = (params: any) => {
  return useQuery({
    queryKey: ['bills', params],
    queryFn: async () => {
      const { data } = await apiClient.get<Paginated<Bill>>('/billing/bills', { params });
      return data;
    },
  });
};

export const useBill = (id: string) => {
  return useQuery({
    queryKey: ['bills', id],
    queryFn: async () => {
      const { data } = await apiClient.get<Bill>(`/billing/bills/${id}`);
      return data;
    },
    enabled: !!id,
  });
};

export const useCreateBill = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (bill: any) => {
      const { data } = await apiClient.post<Bill>('/billing/bills', bill);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills'] });
    },
  });
};

export const useRecordPayment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ billId, payment }: { billId: string; payment: any }) => {
      const { data } = await apiClient.post<Payment>(`/billing/bills/${billId}/payments`, payment);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      queryClient.invalidateQueries({ queryKey: ['bills', variables.billId] });
    },
  });
};

export const useReceiptPdf = (billId: string) => {
  return useQuery({
    queryKey: ['bills', billId, 'pdf'],
    queryFn: async () => {
      const { data } = await apiClient.get(`/billing/bills/${billId}/pdf`, {
        responseType: 'blob',
      });
      return data;
    },
    enabled: false, // Must be called manually
  });
};
