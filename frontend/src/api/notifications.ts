import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';
import { Notification, Paginated, AppNotification, AppNotificationInbox } from '../types';

export const useNotifications = (params?: any) => {
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: async () => {
      const { data } = await apiClient.get<Paginated<Notification>>('/notifications', { params });
      return data;
    },
  });
};

/** Live In-App Notifications for the logged-in staff member. */
export const useInboxNotifications = (params?: { page?: number; size?: number; unreadOnly?: boolean }) => {
  return useQuery({
    queryKey: ['inbox-notifications', params],
    queryFn: async () => {
      const { data } = await apiClient.get<AppNotificationInbox>('/notifications/inbox', { params });
      return data;
    },
    refetchInterval: 15000, // Background polling safety net alongside WebSocket events
  });
};

export const useSendNotification = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      targetRole: string;
      targetUserId?: string | null;
      targetDoctorId?: string | null;
      category: string;
      title: string;
      message: string;
      link?: string | null;
    }) => {
      const { data } = await apiClient.post<AppNotification>('/notifications/send', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox-notifications'] });
    },
  });
};

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.patch<AppNotification>(`/notifications/${id}/read`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox-notifications'] });
    },
  });
};

export const useMarkAllNotificationsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.patch<{ status: string; updatedCount: number }>('/notifications/read-all');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox-notifications'] });
    },
  });
};

export const useDeleteNotification = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete<{ status: string }>(`/notifications/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox-notifications'] });
    },
  });
};

export const useClearAllNotifications = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.delete<{ status: string; deletedCount: number }>('/notifications/clear-all');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox-notifications'] });
    },
  });
};

