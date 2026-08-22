import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';
import { Paginated, Patient } from '../types';

export const usePatients = (params: any) => {
  return useQuery({
    queryKey: ['patients', params],
    queryFn: async () => {
      const { data } = await apiClient.get<Paginated<Patient>>('/patients', { params });
      return data;
    },
  });
};

export const usePatient = (id: string) => {
  return useQuery({
    queryKey: ['patients', id],
    queryFn: async () => {
      const { data } = await apiClient.get<Patient>(`/patients/${id}`);
      return data;
    },
    enabled: !!id,
  });
};

export const useCreatePatient = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patient: any) => {
      const { data } = await apiClient.post<Patient>('/patients', patient);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
};

export const useUpdatePatient = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patient }: any) => {
      const { data } = await apiClient.patch<Patient>(`/patients/${id}`, patient);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['patients', data.id] });
    },
  });
};

export const useSearchPatients = (query: string) => {
  return useQuery({
    queryKey: ['patients', 'search', query],
    queryFn: async () => {
      const { data } = await apiClient.get<Patient[]>('/patients/search', { params: { q: query } });
      return data;
    },
    enabled: query.length >= 3,
  });
};
