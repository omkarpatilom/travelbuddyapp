import React from 'react';
import { AppState } from 'react-native';
import { render, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRealtimeSync, invalidateStatusQueries } from '../cache/realtimeSync';
import { qk } from '../cache/cacheKeys';
import { realtimeHubUrl } from '../services/realtime.service';

// ─── SignalR connection double ───────────────────────────────────────────────

type Handler = (...args: any[]) => void;

class MockConnection {
  state = 'Disconnected';
  handlers: Record<string, Handler> = {};
  reconnected: Handler | null = null;
  start = jest.fn(async () => {
    this.state = 'Connected';
  });
  stop = jest.fn(async () => {
    this.state = 'Disconnected';
  });
  on(event: string, handler: Handler) {
    this.handlers[event] = handler;
  }
  onreconnected(handler: Handler) {
    this.reconnected = handler;
  }
}

let mockConnections: MockConnection[] = [];

jest.mock('../services/realtime.service', () => {
  const actual = jest.requireActual('../services/realtime.service');
  return {
    ...actual,
    realtimeHubUrl: () => 'http://gateway/api/v1/realtime',
    createRealtimeConnection: jest.fn(() => {
      const c = new MockConnection();
      mockConnections.push(c);
      return c;
    }),
  };
});

jest.mock('@microsoft/signalr', () => ({
  HubConnectionState: { Disconnected: 'Disconnected', Connected: 'Connected' },
}));

let mockUser: { id: string } | null = { id: 'user-1' };
jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

jest.mock('../utils/api', () => ({
  getFreshAccessToken: jest.fn(async () => 'token'),
  API_BASE_URL: 'http://gateway/api/v1',
}));

// eslint-disable-next-line import/first
import { RealtimeProvider, REALTIME_FALLBACK_POLL_MS } from '../providers/RealtimeProvider';

function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
}

// ─── realtimeHubUrl ──────────────────────────────────────────────────────────

describe('realtimeHubUrl', () => {
  const { realtimeHubUrl: actualUrl } = jest.requireActual('../services/realtime.service');

  it('appends /realtime to the API base URL', () => {
    expect(actualUrl('http://10.0.0.2:5000/api/v1')).toBe('http://10.0.0.2:5000/api/v1/realtime');
    expect(actualUrl('https://x.ngrok.app/api/v1/')).toBe('https://x.ngrok.app/api/v1/realtime');
  });

  it('is null without a base URL', () => {
    expect(actualUrl('')).toBeNull();
  });

  it('is mocked for the provider tests', () => {
    expect(realtimeHubUrl()).toBe('http://gateway/api/v1/realtime');
  });
});

// ─── createRealtimeSync ──────────────────────────────────────────────────────

describe('createRealtimeSync', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('invalidates every status query, but not ride search', () => {
    const qc = newClient();
    const spy = jest.spyOn(qc, 'invalidateQueries');
    void invalidateStatusQueries(qc);
    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toEqual(
      expect.arrayContaining([qk.activeRides(), qk.myRides(), ['rideDetails'], ['bookings'], ['rideBookings'], ['activeRide']]),
    );
    expect(keys).not.toContainEqual(['rides']);
  });

  it('collapses a burst of signals into one refetch', () => {
    const qc = newClient();
    const spy = jest.spyOn(qc, 'invalidateQueries');
    const sync = createRealtimeSync(qc, { debounceMs: 250 });

    sync.notifyChanged();
    sync.notifyChanged();
    sync.resync();
    expect(spy).not.toHaveBeenCalled();

    jest.advanceTimersByTime(250);
    const bookingCalls = spy.mock.calls.filter((c) => JSON.stringify((c[0] as any).queryKey) === '["bookings"]');
    expect(bookingCalls).toHaveLength(1);
  });

  it('waits for in-flight operations before refetching', () => {
    const qc = newClient();
    const spy = jest.spyOn(qc, 'invalidateQueries');
    const mutating = jest.spyOn(qc, 'isMutating').mockReturnValue(1);
    const sync = createRealtimeSync(qc, { debounceMs: 100 });

    sync.notifyChanged();
    jest.advanceTimersByTime(300);
    expect(spy).not.toHaveBeenCalled();

    mutating.mockReturnValue(0);
    jest.advanceTimersByTime(100);
    expect(spy).toHaveBeenCalled();
  });

  it('marks a cached booking stale so it refetches the new status', async () => {
    jest.useRealTimers();
    const qc = newClient();
    let status = 'Confirmed';
    const queryFn = jest.fn(async () => ({ id: 'b1', status }));
    await qc.fetchQuery({ queryKey: qk.bookingDetails('b1'), queryFn });

    status = 'Boarded';
    const sync = createRealtimeSync(qc, { debounceMs: 0 });
    sync.notifyChanged();
    await new Promise((r) => setTimeout(r, 10));

    expect(qc.getQueryState(qk.bookingDetails('b1'))?.isInvalidated).toBe(true);
    await qc.fetchQuery({ queryKey: qk.bookingDetails('b1'), queryFn });
    expect(qc.getQueryData(qk.bookingDetails('b1'))).toEqual({ id: 'b1', status: 'Boarded' });
  });
});

// ─── RealtimeProvider ────────────────────────────────────────────────────────

describe('RealtimeProvider', () => {
  let appStateListener: ((s: string) => void) | null = null;

  beforeEach(() => {
    jest.useFakeTimers();
    mockConnections = [];
    mockUser = { id: 'user-1' };
    Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type: any, listener: any) => {
      appStateListener = listener;
      return { remove: jest.fn() } as any;
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const mount = (qc = newClient()) => {
    const utils = render(
      <QueryClientProvider client={qc}>
        <RealtimeProvider>{null}</RealtimeProvider>
      </QueryClientProvider>,
    );
    return { qc, ...utils };
  };

  it('connects for a signed-in user and refetches when a status signal arrives', async () => {
    const { qc } = mount();
    const spy = jest.spyOn(qc, 'invalidateQueries');
    await act(async () => {});

    expect(mockConnections).toHaveLength(1);
    expect(mockConnections[0].start).toHaveBeenCalledTimes(1);
    spy.mockClear();

    act(() => {
      mockConnections[0].handlers.BookingChanged({ bookingId: 'b1', rideId: 'r1', status: 'Boarded' });
      jest.advanceTimersByTime(300);
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['bookings'] });
  });

  it('does not connect without a user', () => {
    mockUser = null;
    mount();
    expect(mockConnections).toHaveLength(0);
  });

  it('resyncs after an automatic reconnect', async () => {
    const { qc } = mount();
    await act(async () => {});
    const spy = jest.spyOn(qc, 'invalidateQueries');

    act(() => {
      mockConnections[0].reconnected!();
      jest.advanceTimersByTime(300);
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['rideDetails'] });
  });

  it('closes in the background and reconnects + resyncs in the foreground', async () => {
    const { qc } = mount();
    await act(async () => {});
    const conn = mockConnections[0];

    await act(async () => appStateListener!('background'));
    expect(conn.stop).toHaveBeenCalled();

    const spy = jest.spyOn(qc, 'invalidateQueries');
    await act(async () => appStateListener!('active'));
    expect(conn.start).toHaveBeenCalledTimes(2);
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['bookings'] });
  });

  it('falls back to periodic refetch while the hub is unreachable', async () => {
    const { qc } = mount();
    const conn = mockConnections[0];
    conn.start.mockImplementation(async () => {
      throw new Error('unreachable');
    });
    conn.state = 'Disconnected';
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const spy = jest.spyOn(qc, 'invalidateQueries');

    await act(async () => {
      jest.advanceTimersByTime(REALTIME_FALLBACK_POLL_MS + 300);
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['bookings'] });
    warn.mockRestore();
  });

  it('disconnects on sign-out', async () => {
    const { rerender, qc } = mount();
    await act(async () => {});
    const conn = mockConnections[0];

    mockUser = null;
    rerender(
      <QueryClientProvider client={qc}>
        <RealtimeProvider>{null}</RealtimeProvider>
      </QueryClientProvider>,
    );
    expect(conn.stop).toHaveBeenCalled();
  });
});
