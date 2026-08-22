import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './client';

export interface InventoryItem {
  id: string;
  code: string;
  name: string;
  category: 'MEDICINE' | 'SUPPLY' | 'EQUIPMENT';
  unit: string;
  currentStock: number;
  minimumStock: number;
  unitPrice: number;
  manufacturer?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryTransaction {
  id: string;
  itemId: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  reference?: string;
  notes?: string;
  createdAt: string;
  createdBy: string;
  item?: InventoryItem;
}

export const useInventory = (params?: { search?: string; category?: string; page?: number; pageSize?: number }) => {
  return useQuery({
    queryKey: ['inventory', params],
    queryFn: async () => {
      const { data } = await api.get('/inventory', { params });
      return data;
    },
  });
};

export const useCreateItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (itemData: Partial<InventoryItem>) => {
      const { data } = await api.post('/inventory', itemData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
};

export const useUpdateItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InventoryItem> }) => {
      const response = await api.patch(`/inventory/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
};

export const useTransactions = (itemId?: string, params?: { page?: number; pageSize?: number }) => {
  return useQuery({
    queryKey: ['inventory-transactions', itemId, params],
    queryFn: async () => {
      const { data } = await api.get(itemId ? `/inventory/${itemId}/transactions` : '/inventory/transactions', { params });
      return data;
    },
  });
};

export const useAddTransaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, transactionData }: { itemId: string; transactionData: Partial<InventoryTransaction> }) => {
      const { data } = await api.post(`/inventory/${itemId}/transactions`, transactionData);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-transactions', variables.itemId] });
    },
  });
};
