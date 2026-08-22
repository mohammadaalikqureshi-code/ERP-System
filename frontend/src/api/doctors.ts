import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';
import { Doctor, DoctorSchedule, DoctorLeave, AvailableSlot } from '../types';

export const useDoctors = () => {
  return useQuery({
    queryKey: ['doctors'],
    queryFn: async () => {
      const { data } = await apiClient.get<Doctor[]>('/doctors');
      return data;
    },
  });
};

export const useDoctor = (id: string) => {
  return useQuery({
    queryKey: ['doctors', id],
    queryFn: async () => {
      const { data } = await apiClient.get<Doctor>(`/doctors/${id}`);
      return data;
    },
    enabled: !!id,
  });
};

export const useCreateDoctor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (doctor: any) => {
      const { data } = await apiClient.post<Doctor>('/doctors', doctor);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctors'] });
    },
  });
};

export const useUpdateDoctor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...doctor }: any) => {
      const { data } = await apiClient.patch<Doctor>(`/doctors/${id}`, doctor);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['doctors'] });
      queryClient.invalidateQueries({ queryKey: ['doctors', data.id] });
    },
  });
};

export const useDoctorSchedules = (doctorId: string) => {
  return useQuery({
    queryKey: ['doctors', doctorId, 'schedules'],
    queryFn: async () => {
      const { data } = await apiClient.get<DoctorSchedule[]>(`/doctors/${doctorId}/schedules`);
      return data;
    },
    enabled: !!doctorId,
  });
};

export const useCreateSchedule = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (schedule: any) => {
      const { data } = await apiClient.post<DoctorSchedule>('/schedules', schedule);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['doctors', variables.doctorId, 'schedules'] });
    },
  });
};

export const useDoctorLeaves = (doctorId: string) => {
  return useQuery({
    queryKey: ['doctors', doctorId, 'leaves'],
    queryFn: async () => {
      const { data } = await apiClient.get<DoctorLeave[]>(`/doctors/${doctorId}/leaves`);
      return data;
    },
    enabled: !!doctorId,
  });
};

export const useCreateLeave = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (leave: any) => {
      const { data } = await apiClient.post<DoctorLeave>('/leaves', leave);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['doctors', variables.doctorId, 'leaves'] });
    },
  });
};

export const useAvailableSlots = (doctorId: string, date: string) => {
  return useQuery({
    queryKey: ['doctors', doctorId, 'slots', date],
    queryFn: async () => {
      const { data } = await apiClient.get<{ date: string; slots: AvailableSlot[] }>(
        `/doctors/${doctorId}/slots`,
        { params: { date } }
      );
      return data.slots ?? [];
    },
    enabled: !!doctorId && !!date,
  });
};
