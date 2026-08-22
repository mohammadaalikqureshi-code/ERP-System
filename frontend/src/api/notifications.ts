import { useQuery } from '@tanstack/react-query';
import apiClient from './client';
import { Notification, Paginated } from '../types';

export const useNotifications = (params?: any) => {
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: async () => {
      const { data } = await apiClient.get<Paginated<Notification>>('/notifications', { params });
      return data;
    },
  });
};
