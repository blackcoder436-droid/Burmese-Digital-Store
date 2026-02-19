'use client';

import { useEffect, useRef, useCallback } from 'react';

interface NotificationEvent {
  type: string;
  title: string;
  message: string;
  notificationId: string;
  orderId?: string;
}

interface UseNotificationStreamOptions {
  onNotification: (data: NotificationEvent) => void;
  enabled?: boolean;
}

/**
 * Hook to subscribe to real-time notification events via SSE.
 * Automatically reconnects on disconnect with exponential backoff.
 */
export function useNotificationStream({
  onNotification,
  enabled = true,
}: UseNotificationStreamOptions) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const retryCountRef = useRef(0);
  const onNotificationRef = useRef(onNotification);

  // Keep callback ref updated without causing reconnect
  useEffect(() => {
    onNotificationRef.current = onNotification;
  }, [onNotification]);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const es = new EventSource('/api/notifications/stream');
      eventSourceRef.current = es;

      es.addEventListener('connected', () => {
        retryCountRef.current = 0; // Reset retry count on successful connection
      });

      es.addEventListener('notification', (event) => {
        try {
          const data: NotificationEvent = JSON.parse(event.data);
          onNotificationRef.current(data);
        } catch {
          // Invalid data
        }
      });

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;

        // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);
        retryCountRef.current++;

        reconnectTimeoutRef.current = setTimeout(() => {
          if (enabled) connect();
        }, delay);
      };
    } catch {
      // EventSource not supported or network error
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      return;
    }

    connect();

    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [enabled, connect]);
}
