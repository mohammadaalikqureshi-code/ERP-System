import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';

// ---------------------------------------------------------------- API keys
export interface ApiKey {
  id: string;
  provider: string;
  description?: string;
  label?: string;
  maskedKey: string;
  isActive: boolean;
  lastUsedAt?: string | null;
  lastError?: string | null;
  usageCount: number;
  createdAt?: string;
}

export interface ApiKeyList {
  items: ApiKey[];
  missingProviders: { provider: string; description: string }[];
}

export const useApiKeys = () =>
  useQuery({
    queryKey: ['apiKeys'],
    queryFn: async () => (await apiClient.get<ApiKeyList>('/api-keys')).data,
  });

export const useSaveApiKey = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { provider: string; key: string; label?: string }) =>
      (await apiClient.post<ApiKey>('/api-keys', payload)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      queryClient.invalidateQueries({ queryKey: ['ai', 'status'] });
    },
  });
};

export const useDeleteApiKey = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api-keys/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      queryClient.invalidateQueries({ queryKey: ['ai', 'status'] });
    },
  });
};

/** Make a real call with the stored key so the admin knows it works. */
export const useTestApiKey = () =>
  useMutation({
    mutationFn: async (provider: string) =>
      (
        await apiClient.post<{ provider: string; ok: boolean; message: string }>(
          `/api-keys/${provider}/test`
        )
      ).data,
  });

// ------------------------------------------------------------------ panels
export interface PanelModule {
  key: string;
  label: string;
  description: string;
  isEnabled: boolean;
  isDefault: boolean;
  roles: string[];
  config: Record<string, unknown>;
}

export const usePanels = () =>
  useQuery({
    queryKey: ['panels'],
    queryFn: async () => (await apiClient.get<PanelModule[]>('/panels')).data,
  });

/** The panels this clinic uses — drives the sidebar for every signed-in user. */
export const useEnabledPanels = () =>
  useQuery({
    queryKey: ['panels', 'enabled'],
    queryFn: async () => (await apiClient.get<{ enabled: string[] }>('/panels/enabled')).data,
    staleTime: 5 * 60_000,
  });

export const useUpdatePanel = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, isEnabled }: { key: string; isEnabled: boolean }) =>
      (await apiClient.patch<PanelModule>(`/panels/${key}`, { isEnabled })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panels'] });
    },
  });
};
