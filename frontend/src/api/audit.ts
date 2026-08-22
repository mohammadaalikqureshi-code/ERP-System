import { useQuery } from '@tanstack/react-query';
import apiClient from './client';
import { AuditLog, Paginated } from '../types';

export const useAuditLogs = (params: any) => {
  return useQuery({
    queryKey: ['auditLogs', params],
    queryFn: async () => {
      const { data } = await apiClient.get<Paginated<AuditLog>>('/audit-logs', { params });
      return data;
    },
  });
};
