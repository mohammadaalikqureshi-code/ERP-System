import { useQuery } from '@tanstack/react-query';
import api from './client';

export interface RevenueDataPoint {
  date: string;
  revenue: number;
  consultations: number;
}

export interface DoctorPerformanceData {
  doctorId: string;
  doctorName: string;
  totalAppointments: number;
  completedAppointments: number;
  revenueGenerated: number;
  averageRating?: number;
}

export interface NoShowData {
  status: string;
  count: number;
  percentage: number;
}

export const useRevenueReport = (params?: { startDate?: string; endDate?: string; period?: 'daily' | 'weekly' | 'monthly' }) => {
  return useQuery({
    queryKey: ['reports', 'revenue', params],
    queryFn: async () => {
      const { data } = await api.get('/reports/revenue', { params });
      return data;
    },
  });
};

export const useDoctorPerformance = (params?: { startDate?: string; endDate?: string }) => {
  return useQuery({
    queryKey: ['reports', 'performance', params],
    queryFn: async () => {
      const { data } = await api.get('/reports/doctor-performance', { params });
      return data;
    },
  });
};

export const useNoShowRates = (params?: { startDate?: string; endDate?: string }) => {
  return useQuery({
    queryKey: ['reports', 'no-show', params],
    queryFn: async () => {
      const { data } = await api.get('/reports/no-show-rates', { params });
      return data;
    },
  });
};
