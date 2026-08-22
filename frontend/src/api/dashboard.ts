import { useQuery } from '@tanstack/react-query';
import apiClient from './client';
import { ReceptionDashboard, DoctorDashboard, AdminDashboard } from '../types';

export const useReceptionDashboard = () => {
  return useQuery({
    queryKey: ['dashboard', 'reception'],
    queryFn: async () => {
      const { data } = await apiClient.get<ReceptionDashboard>('/dashboard/reception');
      return data;
    },
  });
};

export const useDoctorDashboard = () => {
  return useQuery({
    queryKey: ['dashboard', 'doctor'],
    queryFn: async () => {
      const { data } = await apiClient.get<DoctorDashboard>('/dashboard/doctor');
      return data;
    },
  });
};

export const useAdminDashboard = (params?: { startDate?: string; endDate?: string }) => {
  return useQuery({
    queryKey: ['dashboard', 'admin', params],
    queryFn: async () => {
      const { data } = await apiClient.get<AdminDashboard>('/dashboard/admin', { params });
      return data;
    },
  });
};
