import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { HubConnectionState } from '@microsoft/signalr';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { getFreshAccessToken } from '../utils/api';
import { createRealtimeSync } from '../cache/realtimeSync';
import {
  createRealtimeConnection,
  realtimeHubUrl,
  REALTIME_EVENTS,
} from '../services/realtime.service';

/**
 * While the hub is unreachable, screens on display are refetched at this
 * interval instead — a safety net, not the primary mechanism.
 */
export const REALTIME_FALLBACK_POLL_MS = 30_000;

/**
 * Keeps ride and booking status on screen in step with the server without
 * manual refreshes. Holds one RealtimeHub connection for the signed-in user
 * while the app is in the foreground and turns each status signal into a
 * refetch of the shared query cache, so every screen showing that ride or
 * booking updates. Anything missed while disconnected or backgrounded is
 * picked up by refetching on reconnect and on return to the foreground; push
 * notifications cover the app while it is in the background.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id;

  useEffect(() => {
    const url = realtimeHubUrl();
    if (!userId || !url) return;

    const sync = createRealtimeSync(qc);
    const connection = createRealtimeConnection(url, getFreshAccessToken);
    let disposed = false;
    let appActive = AppState.currentState === 'active';
    let starting: Promise<void> | null = null;

    connection.on(REALTIME_EVENTS.RIDE_CHANGED, () => sync.notifyChanged());
    connection.on(REALTIME_EVENTS.BOOKING_CHANGED, () => sync.notifyChanged());
    connection.onreconnected(() => sync.resync());

    const start = () => {
      if (disposed || !appActive || starting || connection.state !== HubConnectionState.Disconnected) return;
      starting = connection
        .start()
        // Changes made between the screens' last fetch and now were not signalled.
        .then(() => sync.resync())
        .catch((e) => console.warn('[Realtime] connect failed:', e?.message ?? e))
        .finally(() => {
          starting = null;
        });
    };

    const stop = () => {
      connection.stop().catch(() => {});
    };

    start();

    const appStateSub = AppState.addEventListener('change', (next) => {
      const wasActive = appActive;
      appActive = next === 'active';
      if (appActive && !wasActive) {
        start();
        sync.resync();
      } else if (!appActive && wasActive) {
        // The OS suspends or kills background sockets anyway; closing it
        // ourselves keeps reconnect state predictable and saves battery.
        stop();
      }
    });

    const netInfoUnsub = NetInfo.addEventListener((state) => {
      if (state.isConnected) start();
    });

    const fallback = setInterval(() => {
      if (!appActive || connection.state === HubConnectionState.Connected) return;
      sync.resync();
      start();
    }, REALTIME_FALLBACK_POLL_MS);

    return () => {
      disposed = true;
      appStateSub.remove();
      netInfoUnsub?.();
      clearInterval(fallback);
      sync.dispose();
      stop();
    };
  }, [userId, qc]);

  return <>{children}</>;
}
