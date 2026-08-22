import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';

export interface AiStatus {
  available: boolean;
  reason?: string | null;
  provider?: string | null;
  model?: string | null;
}

export interface ChatReply {
  conversationId: string;
  reply: string;
  model?: string;
}

export interface AiInsight {
  id: string;
  kind: string;
  content: string;
  entityType?: string;
  entityId?: string;
  data?: Record<string, unknown>;
  model?: string;
  createdAt?: string;
}

/** Is the assistant configured and usable? Everything else checks this first. */
export const useAiStatus = () =>
  useQuery({
    queryKey: ['ai', 'status'],
    queryFn: async () => (await apiClient.get<AiStatus>('/ai/status')).data,
    staleTime: 60_000,
  });

export const useAiChat = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      message: string;
      conversationId?: string;
      patientId?: string;
    }) => (await apiClient.post<ChatReply>('/ai/chat', payload)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai', 'conversations'] });
    },
  });
};

export const useAiConversations = (enabled = true) =>
  useQuery({
    queryKey: ['ai', 'conversations'],
    queryFn: async () => (await apiClient.get('/ai/conversations')).data,
    enabled,
  });

/** Draft a consultation summary from what was recorded during the visit. */
export const useConsultationSummary = () =>
  useMutation({
    mutationFn: async (appointmentId: string) =>
      (await apiClient.post<AiInsight>(`/ai/consultations/${appointmentId}/summary`)).data,
  });

/** Safety-check a draft prescription before it is signed. */
export const usePrescriptionCheck = () =>
  useMutation({
    mutationFn: async (payload: {
      patientId: string;
      medicines: {
        medicineName: string;
        dosage: string;
        frequency: string;
        durationDays: string;
        instructions?: string;
      }[];
    }) =>
      (
        await apiClient.post<{
          id: string;
          content: string;
          hasCritical: boolean;
          model?: string;
        }>('/ai/prescriptions/check', payload)
      ).data,
  });

export const useLabInterpretation = () =>
  useMutation({
    mutationFn: async (orderId: string) =>
      (await apiClient.post<AiInsight>(`/ai/lab-orders/${orderId}/interpretation`)).data,
  });

export const useTriageNote = () =>
  useMutation({
    mutationFn: async (note: string) =>
      (await apiClient.post<{ content: string; model?: string }>('/ai/triage', { note })).data,
  });

export const useDailyDigest = () =>
  useMutation({
    mutationFn: async (on?: string) =>
      (
        await apiClient.post<{
          id: string;
          content: string;
          stats: Record<string, number | string | null>;
          model?: string;
        }>('/ai/digest', { on })
      ).data,
  });

export const useAiInsights = (params: { kind?: string; entityId?: string } = {}) =>
  useQuery({
    queryKey: ['ai', 'insights', params],
    queryFn: async () => (await apiClient.get<AiInsight[]>('/ai/insights', { params })).data,
  });
