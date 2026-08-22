import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';
import { Vitals, Prescription, MedicalHistory } from '../types';

export const emrKeys = {
  all: ['emr'] as const,
  vitals: (appointmentId: string) => [...emrKeys.all, 'vitals', appointmentId] as const,
  history: (patientId: string) => [...emrKeys.all, 'history', patientId] as const,
  prescription: (appointmentId: string) => [...emrKeys.all, 'prescription', appointmentId] as const,
};

// Vitals
export const useVitals = (appointmentId: string) => {
  return useQuery({
    queryKey: emrKeys.vitals(appointmentId),
    queryFn: async () => {
      const { data } = await apiClient.get<Vitals>(`/emr/vitals/${appointmentId}`);
      return data;
    },
    enabled: !!appointmentId,
  });
};

export const useSaveVitals = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Vitals> & { appointmentId: string }) => {
      const { data } = await apiClient.post<Vitals>('/emr/vitals', payload);
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(emrKeys.vitals(variables.appointmentId), data);
      queryClient.invalidateQueries({ queryKey: emrKeys.vitals(variables.appointmentId) });
    },
  });
};

// Medical History
export const useHistory = (patientId: string) => {
  return useQuery({
    queryKey: emrKeys.history(patientId),
    queryFn: async () => {
      const { data } = await apiClient.get<MedicalHistory[]>(`/emr/history/${patientId}`);
      return data;
    },
    enabled: !!patientId,
  });
};

// Prescription
export const usePrescription = (appointmentId: string) => {
  return useQuery({
    queryKey: emrKeys.prescription(appointmentId),
    queryFn: async () => {
      const { data } = await apiClient.get<Prescription>(`/emr/prescription/${appointmentId}`);
      return data;
    },
    enabled: !!appointmentId,
  });
};

export const useCreatePrescription = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Prescription> & { appointmentId: string }) => {
      const { data } = await apiClient.post<Prescription>('/emr/prescription', payload);
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(emrKeys.prescription(variables.appointmentId), data);
      queryClient.invalidateQueries({ queryKey: emrKeys.prescription(variables.appointmentId) });
    },
  });
};
