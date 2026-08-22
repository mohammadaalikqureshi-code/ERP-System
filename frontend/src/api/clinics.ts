import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';
import { Clinic, Holiday, ClinicSettings } from '../types';

export const useClinics = () => {
  return useQuery({
    queryKey: ['clinics'],
    queryFn: async () => {
      const { data } = await apiClient.get<Clinic[]>('/clinics');
      return data;
    },
  });
};

export const useClinic = (id: string) => {
  return useQuery({
    queryKey: ['clinics', id],
    queryFn: async () => {
      const { data } = await apiClient.get<Clinic>(`/clinics/${id}`);
      return data;
    },
    enabled: !!id,
  });
};

export const useCreateClinic = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (clinic: any) => {
      const { data } = await apiClient.post<Clinic>('/clinics', clinic);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinics'] });
    },
  });
};

export const useUpdateClinic = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...clinic }: any) => {
      const { data } = await apiClient.patch<Clinic>(`/clinics/${id}`, clinic);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['clinics'] });
      queryClient.invalidateQueries({ queryKey: ['clinics', data.id] });
    },
  });
};

export const useHolidays = (clinicId: string) => {
  return useQuery({
    queryKey: ['clinics', clinicId, 'holidays'],
    queryFn: async () => {
      const { data } = await apiClient.get<Holiday[]>(`/clinics/${clinicId}/holidays`);
      return data;
    },
    enabled: !!clinicId,
  });
};

export const useCreateHoliday = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (holiday: any) => {
      const { data } = await apiClient.post<Holiday>(`/clinics/${holiday.clinicId}/holidays`, holiday);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['clinics', variables.clinicId, 'holidays'] });
    },
  });
};

export const useClinicSettings = (clinicId: string) => {
  return useQuery({
    queryKey: ['clinics', clinicId, 'settings'],
    queryFn: async () => {
      const { data } = await apiClient.get<ClinicSettings>(`/clinics/${clinicId}/settings`);
      return data;
    },
    enabled: !!clinicId,
  });
};

export const useUpdateClinicSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ clinicId, ...settings }: any) => {
      const { data } = await apiClient.patch<ClinicSettings>(`/clinics/${clinicId}/settings`, settings);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['clinics', variables.clinicId, 'settings'] });
    },
  });
};
