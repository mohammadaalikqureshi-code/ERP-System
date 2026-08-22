import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../stores/authStore';
import { API_BASE_URL } from '../lib/constants';
import { keysToCamelCase, keysToSnakeCase } from '../lib/case';

/**
 * The single HTTP client for the whole app.
 *
 * It takes care of four things so no page has to:
 *   1. attaching the access token and the active clinic id
 *   2. translating camelCase <-> snake_case at the API boundary
 *   3. refreshing an expired access token exactly once, queuing calls meanwhile
 *   4. surfacing a consistent `error.message` for the UI to display
 *
 * The refresh token itself lives in an httpOnly cookie set by the backend, so
 * JavaScript never touches it — that is why every call sends credentials.
 */
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
  timeout: 30_000,
});

type RetriableRequest = InternalAxiosRequestConfig & { _retry?: boolean };

let refreshRequest: Promise<string> | null = null;

apiClient.interceptors.request.use((config) => {
  const { accessToken, clinicId } = useAuthStore.getState();

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  if (clinicId) {
    config.headers['X-Clinic-ID'] = clinicId;
  }

  // FormData (file uploads) must be sent exactly as built.
  if (config.data && !(config.data instanceof FormData)) {
    config.data = keysToSnakeCase(config.data);
  }
  if (config.params) {
    config.params = keysToSnakeCase(config.params);
  }

  return config;
});

/** Ask the backend for a new access token, reusing one in-flight request. */
async function refreshAccessToken(): Promise<string> {
  if (!refreshRequest) {
    refreshRequest = axios
      .post(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true })
      .then((response) => {
        const token = keysToCamelCase<{ accessToken: string }>(response.data).accessToken;
        useAuthStore.getState().setAccessToken(token);
        return token;
      })
      .finally(() => {
        refreshRequest = null;
      });
  }
  return refreshRequest;
}

apiClient.interceptors.response.use(
  (response) => {
    if (response.data && !(response.data instanceof Blob)) {
      response.data = keysToCamelCase(response.data);
    }
    return response;
  },
  async (error: AxiosError<any>) => {
    const originalRequest = error.config as RetriableRequest | undefined;

    // An expired access token: refresh once, then replay the original call.
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const token = await refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return apiClient(originalRequest);
      } catch {
        useAuthStore.getState().logout();
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    }

    // Give every caller one predictable place to read a human-readable reason.
    const payload = error.response?.data as
      | { error?: { message?: string }; detail?: string | { msg?: string }[] }
      | undefined;
    const detail = payload?.detail;
    error.message =
      payload?.error?.message ||
      (typeof detail === 'string' ? detail : Array.isArray(detail) ? detail[0]?.msg : undefined) ||
      error.message ||
      'Something went wrong. Please try again.';

    return Promise.reject(error);
  }
);

export default apiClient;
