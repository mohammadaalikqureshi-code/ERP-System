import { useMutation, useQuery } from '@tanstack/react-query';
import apiClient from './client';
import { useAuthStore } from '../stores/authStore';

export const useLogin = () => {
  return useMutation({
    mutationFn: async (credentials: any) => {
      const { data } = await apiClient.post('/auth/login', credentials);
      return data;
    },
    onSuccess: (data) => {
      useAuthStore.getState().setAuth(data.profile, data.accessToken);
    },
  });
};

export const useLogout = () => {
  return useMutation({
    mutationFn: async () => {
      await apiClient.post('/auth/logout');
    },
    onSuccess: () => {
      useAuthStore.getState().logout();
    },
  });
};

export const useCurrentUser = () => {
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const { data } = await apiClient.get('/auth/me');
      return data;
    },
  });
};

export const useOTPRequest = () => {
  return useMutation({
    mutationFn: async (phone: string) => {
      const { data } = await apiClient.post('/auth/otp/request', { phone });
      return data;
    }
  });
};

export const useOTPVerify = () => {
  return useMutation({
    mutationFn: async (payload: { phone: string, otp: string }) => {
      const { data } = await apiClient.post('/auth/otp/verify', payload);
      return data;
    },
    onSuccess: (data) => {
      useAuthStore.getState().setAuth(data.profile, data.accessToken);
    }
  });
};
