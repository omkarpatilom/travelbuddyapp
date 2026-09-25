import {
  HttpTransportType,
  HubConnection,
  HubConnectionBuilder,
  LogLevel,
} from '@microsoft/signalr';
import { API_BASE_URL } from '../utils/api';

/**
 * Status-change signals pushed by RideService's RealtimeHub. They only say
 * *what* changed; screens get the new state by refetching over REST.
 */
export const REALTIME_EVENTS = {
  RIDE_CHANGED: 'RideChanged',
  BOOKING_CHANGED: 'BookingChanged',
} as const;

export interface RideChangedMessage {
  rideId: string;
  status: string;
  occurredAt: string;
}

export interface BookingChangedMessage {
  bookingId: string;
  rideId: string;
  status: string;
  occurredAt: string;
}

/** The gateway maps /api/v1/realtime to RideService's /realtimeHub. */
export function realtimeHubUrl(baseUrl: string | undefined = API_BASE_URL): string | null {
  if (!baseUrl) return null;
  return `${baseUrl.replace(/\/+$/, '')}/realtime`;
}

/**
 * One connection per signed-in device. React Native has no EventSource, so
 * only WebSockets is usable; skipping negotiation also means no sticky
 * sessions are needed behind the gateway. On React Native the client sends the
 * token as an Authorization header on the WebSocket handshake.
 */
export function createRealtimeConnection(
  url: string,
  getAccessToken: () => Promise<string | null>,
): HubConnection {
  return new HubConnectionBuilder()
    .withUrl(url, {
      transport: HttpTransportType.WebSockets,
      skipNegotiation: true,
      accessTokenFactory: async () => (await getAccessToken()) ?? '',
    })
    // After these attempts the connection closes; RealtimeProvider restarts it
    // when the app returns to the foreground or the network comes back.
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
    .configureLogging(LogLevel.Warning)
    .build();
}
