import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserProfile } from '../types';
import apiClient from '../api/client';
import { parseJwtPayload } from '../lib/jwt';

interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  clinicId: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  setAuth: (user: UserProfile | any, token: string) => void;
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
      setAuth: (user, token) => {
        let finalUser: any = user ? { ...user } : {};
        let finalClinicId = finalUser.clinicId;

        if (token) {
          const jwtData = parseJwtPayload(token);
          if (jwtData) {
            if (!finalUser.id && jwtData.sub) finalUser.id = jwtData.sub;
            if (!finalUser.role && (jwtData.role || jwtData.role_name)) {
              finalUser.role = jwtData.role || jwtData.role_name;
            }
            if (!finalUser.roleName && (jwtData.role_name || jwtData.role)) {
              finalUser.roleName = jwtData.role_name || jwtData.role;
            }
            if (!finalClinicId && jwtData.clinic_id) {
              finalClinicId = jwtData.clinic_id;
              finalUser.clinicId = jwtData.clinic_id;
            }
          }
        }

        set({
          user: finalUser,
          accessToken: token,
          clinicId: finalClinicId || null,
          isAuthenticated: true,
        });
      },
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
      setTokens: (accessToken) => {
        let user: any = {};
        const jwtData = parseJwtPayload(accessToken);
        if (jwtData) {
          user = {
            id: jwtData.sub,
            role: jwtData.role || jwtData.role_name,
            roleName: jwtData.role_name || jwtData.role,
            clinicId: jwtData.clinic_id,
          };
        }
        set({ accessToken, user, clinicId: user.clinicId || null, isAuthenticated: true });
      },
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
          if (state.accessToken && (!state.user || !state.user.role)) {
            const jwtData = parseJwtPayload(state.accessToken);
            if (jwtData) {
              state.user = {
                ...(state.user || {}),
                id: state.user?.id || jwtData.sub,
                role: state.user?.role || jwtData.role || jwtData.role_name,
                roleName: state.user?.roleName || jwtData.role_name || jwtData.role,
                fullName: state.user?.fullName || '',
                phone: state.user?.phone || '',
                clinicId: state.clinicId || jwtData.clinic_id,
              } as UserProfile;
              if (jwtData.clinic_id && !state.clinicId) {
                state.clinicId = jwtData.clinic_id;
              }
            }
          }
          state.setHydrated();
        }
      },
    }
  )
);

export const useUser = () => useAuthStore((state) => state.user);
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);
export const useUserRole = () => useAuthStore((state) => state.user?.role);
