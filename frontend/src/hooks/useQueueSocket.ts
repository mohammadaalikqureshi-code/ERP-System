import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { API_BASE_URL } from '@/lib/constants';
import { EVENT_QUERY_KEYS, RealtimeEvent } from '@/lib/realtime';

interface UseQueueSocketOptions {
  clinicId: string;
  doctorId?: string;
  onUpdate?: (event: RealtimeEvent) => void;
}

/**
 * Live queue updates.
 *
 * Signed-in staff connect to the authenticated socket. The waiting-room screen
 * has nobody to sign in, so with no token it uses the public socket instead —
 * that one only ever carries "something changed" signals, never patient data.
 *
 * Reconnects with exponential backoff, because a TV in a waiting room has to
 * survive the network dropping overnight without anyone touching it.
 */
export function useQueueSocket({ clinicId, doctorId, onUpdate }: UseQueueSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closedByUs = useRef(false);

  const accessToken = useAuthStore((state) => state.accessToken);
  const queryClient = useQueryClient();

  const buildUrl = useCallback(() => {
    const base = API_BASE_URL.startsWith('http')
      ? API_BASE_URL.replace(/^http/, 'ws')
      : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}${API_BASE_URL}`;

    if (!accessToken) {
      return `${base}/ws/queue/public?clinic_id=${encodeURIComponent(clinicId)}`;
    }

    const params = new URLSearchParams({ token: accessToken, clinic_id: clinicId });
    if (doctorId) params.set('doctor_id', doctorId);
    return `${base}/ws/queue?${params.toString()}`;
  }, [accessToken, clinicId, doctorId]);

  const connect = useCallback(() => {
    if (!clinicId) return;

    const socket = new WebSocket(buildUrl());
    socketRef.current = socket;

    socket.onopen = () => {
      setIsConnected(true);
      retryRef.current = 0;
    };

    socket.onmessage = (event) => {
      let message: RealtimeEvent;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }

      // Refresh whatever this event makes stale. Unknown events fall back to
      // the queue, which is what the socket is mainly for.
      const keys = EVENT_QUERY_KEYS[message.type] ?? [['queue']];
      keys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));

      onUpdate?.(message);
    };

    socket.onclose = () => {
      setIsConnected(false);
      if (closedByUs.current) return;

      const delay = Math.min(1000 * 2 ** retryRef.current, 30_000);
      retryRef.current += 1;
      timerRef.current = setTimeout(connect, delay);
    };

    socket.onerror = () => socket.close();
  }, [buildUrl, clinicId, onUpdate, queryClient]);

  useEffect(() => {
    closedByUs.current = false;
    connect();

    return () => {
      closedByUs.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      socketRef.current?.close();
    };
  }, [connect]);

  return { isConnected };
}
