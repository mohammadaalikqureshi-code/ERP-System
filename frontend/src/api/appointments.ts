import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';
import { Appointment, Paginated, QueueData } from '../types';

export const useAppointments = (params: any) => {
  return useQuery({
    queryKey: ['appointments', params],
    queryFn: async () => {
      const { data } = await apiClient.get<Paginated<Appointment>>('/appointments', { params });
      return data;
    },
  });
};

export const useAppointment = (id: string) => {
  return useQuery({
    queryKey: ['appointments', id],
    queryFn: async () => {
      const { data } = await apiClient.get<Appointment>(`/appointments/${id}`);
      return data;
    },
    enabled: !!id,
  });
};

export const useCreateAppointment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (appointment: any) => {
      const { data } = await apiClient.post<Appointment>('/appointments', appointment);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['queue'] });
    },
  });
};

export const useUpdateAppointmentStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data } = await apiClient.patch<Appointment>(`/appointments/${id}/status`, { status });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointments', data.id] });
      queryClient.invalidateQueries({ queryKey: ['queue'] });
    },
  });
};

export const useRescheduleAppointment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, date, time }: { id: string; date: string; time: string }) => {
      const { data } = await apiClient.post<Appointment>(`/appointments/${id}/reschedule`, { date, time });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointments', data.id] });
    },
  });
};

export const useQueueToday = (doctorId?: string) => {
  return useQuery({
    queryKey: ['queue', doctorId],
    queryFn: async () => {
      const params = doctorId ? { doctorId } : {};
      const { data } = await apiClient.get<QueueData>('/appointments/queue', { params });
      return data;
    },
  });
};

export const useDoctorTodayAppointments = (doctorId?: string) => {
  return useQuery({
    queryKey: ['doctorTodayAppointments', doctorId],
    queryFn: async () => {
      const params = doctorId ? { doctorId } : {};
      const { data } = await apiClient.get<Appointment[]>('/appointments/doctor/today', { params });
      return data;
    },
    refetchInterval: 10000,
  });
};

export const useStartNextConsultation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (doctorId?: string) => {
      const params = doctorId ? { doctorId } : {};
      const { data } = await apiClient.post<Appointment>('/appointments/doctor/start-next', {}, { params });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointments', data.id] });
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      queryClient.invalidateQueries({ queryKey: ['doctorDashboard'] });
      queryClient.invalidateQueries({ queryKey: ['doctorTodayAppointments'] });
    },
  });
};

