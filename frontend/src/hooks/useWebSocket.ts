import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { API_BASE_URL } from '../lib/constants';
import { EVENT_QUERY_KEYS, RealtimeEvent } from '../lib/realtime';

interface UseWebSocketOptions {
  /** Path under the API root, e.g. "/ws/queue". */
  url: string;
  onMessage?: (event: RealtimeEvent) => void;
  enabled?: boolean;
}

/**
 * A general-purpose authenticated WebSocket with automatic reconnect.
 *
 * Incoming events invalidate the React Query keys listed in `lib/realtime.ts`,
 * so screens refresh themselves without each page wiring that up.
 */
export const useWebSocket = ({ url, onMessage, enabled = true }: UseWebSocketOptions) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptsRef = useRef(0);
  const closedByUs = useRef(false);
  // Store the callback in a ref so changing it doesn't reconnect the socket.
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const token = useAuthStore((state) => state.accessToken);
  const clinicId = useAuthStore((state) => state.clinicId);
  const queryClient = useQueryClient();

  const connect = useCallback(() => {
    if (!enabled || !token) return;

    const path = url.startsWith('/') ? url : `/${url}`;
    const base = API_BASE_URL.startsWith('http')
      ? API_BASE_URL.replace(/^http/, 'ws')
      : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}${API_BASE_URL}`;

    const socketUrl = new URL(`${base}${path}`);
    socketUrl.searchParams.set('token', token);
    if (clinicId) socketUrl.searchParams.set('clinic_id', clinicId);

    const socket = new WebSocket(socketUrl.toString());
    socketRef.current = socket;

    socket.onopen = () => {
      setIsConnected(true);
      setIsReconnecting(false);
      attemptsRef.current = 0;
    };

    socket.onmessage = (event) => {
      let message: RealtimeEvent;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }

      (EVENT_QUERY_KEYS[message.type] ?? []).forEach((key) =>
        queryClient.invalidateQueries({ queryKey: key })
      );
      onMessageRef.current?.(message);
    };

    socket.onclose = () => {
      setIsConnected(false);
      if (closedByUs.current || !enabled) return;

      setIsReconnecting(true);
      const delay = Math.min(1000 * 2 ** attemptsRef.current, 30_000);
      attemptsRef.current += 1;
      timerRef.current = setTimeout(connect, delay);
    };

    socket.onerror = () => socket.close();
  }, [clinicId, enabled, queryClient, token, url]);

  useEffect(() => {
    closedByUs.current = false;
    connect();

    return () => {
      closedByUs.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      socketRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((data: unknown) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(data));
    }
  }, []);

  const disconnect = useCallback(() => {
    closedByUs.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    socketRef.current?.close();
  }, []);

  return { isConnected, isReconnecting, send, disconnect };
};
