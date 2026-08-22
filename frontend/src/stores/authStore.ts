import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserProfile } from '../types';
import apiClient from '../api/client';

interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  clinicId: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  setAuth: (user: UserProfile, token: string) => void;
  setAccessToken: (token: string) => void;
  setClinicId: (clinicId: string) => void;
  logout: () => void;
  setHydrated: () => void;
  setTokens: (accessToken: string, refreshToken?: string) => void;
  fetchUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      clinicId: null,
      isAuthenticated: false,
      isHydrated: false,
      setAuth: (user, token) =>
        set({ user, accessToken: token, isAuthenticated: true }),
      setAccessToken: (token) => set({ accessToken: token }),
      setClinicId: (clinicId) => set({ clinicId }),
      logout: () => {
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
          clinicId: null,
        });
      },
      setHydrated: () => set({ isHydrated: true }),
      setTokens: (accessToken) => set({ accessToken, isAuthenticated: true }),
      fetchUser: async () => {
        const response = await apiClient.get('/auth/me');
        set({ user: response.data });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, clinicId: state.clinicId, accessToken: state.accessToken, isAuthenticated: state.isAuthenticated }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setHydrated();
        }
      },
    }
  )
);

export const useUser = () => useAuthStore((state) => state.user);
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);
export const useUserRole = () => useAuthStore((state) => state.user?.role);
