import React from 'react';
import { Text } from 'react-native';
import { render, act, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../utils/api';
import { qk } from '../cache/cacheKeys';
import {
  __resetOverlays,
  applyOverlays,
  commitEntity,
  patchEntity,
  rollbackEntity,
} from '../cache/entityCache';
import {
  __resetOperations,
  runOperation,
  subscribeFeedback,
  useOperation,
  FeedbackEvent,
} from '../hooks/mutations/operations';
import {
  cancelBookingOp,
  confirmBookingOp,
  createBookingOp,
  dropOffBookingOp,
  verifyBookingOp,
  completeBookingOp,
} from '../hooks/useBookings';
import { cancelRideOp, createRideOp, rideTransitionOp } from '../hooks/useRides';

jest.mock('../utils/api');
jest.mock('../utils/mappers', () => ({
  mapRideData: jest.fn(async (r: any) => r),
  mapBookingData: jest.fn(async (b: any) => ({ ...b, id: b.bookingId ?? b.id })),
}));

const deferred = <T = unknown,>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const ride = { id: 'r1', driverId: 'd1', status: 'published', from: { address: 'A' }, to: { address: 'B' }, date: '2026-10-01', time: '09:00' };
const booking = (status = 'pending') => ({ id: 'b1', bookingId: 'b1', rideId: 'r1', status, seats: 1, ride });

let qc: QueryClient;

beforeEach(async () => {
  jest.clearAllMocks();
  __resetOverlays();
  __resetOperations();
  await AsyncStorage.clear();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  // No query observers in these tests, so invalidation never refetches.
  (api.get as jest.Mock).mockResolvedValue([]);
});

afterEach(() => qc.clear());

const seedBooking = (status = 'pending') => {
  qc.setQueryData(qk.myBookings(), [booking(status)]);
  qc.setQueryData(qk.bookingDetails('b1'), booking(status));
  qc.setQueryData(qk.rideBookings('r1'), [{ ...booking(status) }]);
};

const statuses = () => [
  (qc.getQueryData<any[]>(qk.myBookings()) ?? [])[0]?.status,
  qc.getQueryData<any>(qk.bookingDetails('b1'))?.status,
  (qc.getQueryData<any[]>(qk.rideBookings('r1')) ?? [])[0]?.status,
];

describe('entityCache', () => {
  it('patches an entity in every query that shows it and rolls back', () => {
    seedBooking('pending');
    const snap = patchEntity(qc, 'booking', 'b1', { status: 'cancelled' });
    expect(statuses()).toEqual(['cancelled', 'cancelled', 'cancelled']);

    rollbackEntity(qc, snap);
    expect(statuses()).toEqual(['pending', 'pending', 'pending']);
  });

  it('keeps an overlay applied to fresh server data until committed', () => {
    const snap = patchEntity(qc, 'booking', 'b1', { status: 'cancelled' });
    // A refetch that lands mid-mutation still shows the optimistic value.
    expect(applyOverlays('booking', booking('pending')).status).toBe('cancelled');
    commitEntity(qc, snap);
    expect(applyOverlays('booking', booking('pending')).status).toBe('pending');
  });

  it('rolling back one mutation does not undo another still running', () => {
    seedBooking('pending');
    const a = patchEntity(qc, 'booking', 'b1', { _pending: { op: 'x', label: 'Accepting…' } });
    patchEntity(qc, 'booking', 'b1', { status: 'cancelled' });
    rollbackEntity(qc, a);
    const current = qc.getQueryData<any>(qk.bookingDetails('b1'));
    expect(current.status).toBe('cancelled');
    expect(current._pending).toBeUndefined();
  });

  it('updates the ride embedded in a booking when the ride changes', () => {
    seedBooking('confirmed');
    qc.setQueryData(qk.rideDetails('r1'), ride);
    patchEntity(qc, 'ride', 'r1', { status: 'cancelled' });
    expect(qc.getQueryData<any>(qk.rideDetails('r1')).status).toBe('cancelled');
    expect(qc.getQueryData<any>(qk.bookingDetails('b1')).ride.status).toBe('cancelled');
  });
});

describe('operations', () => {
  it('optimistic cancel shows immediately and rolls back when the server refuses', async () => {
    seedBooking('confirmed');
    const call = deferred();
    (api.post as jest.Mock).mockReturnValue(call.promise);

    const p = runOperation(qc, cancelBookingOp, { bookingId: 'b1', rideId: 'r1', reason: 'User cancelled' });
    await waitFor(() => expect(statuses()).toEqual(['cancelled', 'cancelled', 'cancelled']));

    call.reject(new Error('Too late to cancel'));
    await expect(p).rejects.toThrow('Too late to cancel');
    expect(statuses()).toEqual(['confirmed', 'confirmed', 'confirmed']);
  });

  it('pending accept shows "Accepting…" without claiming success, then confirms', async () => {
    seedBooking('pending');
    const call = deferred();
    (api.post as jest.Mock).mockReturnValue(call.promise);

    const p = runOperation(qc, confirmBookingOp, { bookingId: 'b1', rideId: 'r1' });
    await waitFor(() => expect(qc.getQueryData<any>(qk.bookingDetails('b1'))._pending?.label).toBe('Accepting…'));
    expect(statuses()).toEqual(['pending', 'pending', 'pending']);

    call.resolve(true);
    await p;
    expect(statuses()).toEqual(['confirmed', 'confirmed', 'confirmed']);
    expect(qc.getQueryData<any>(qk.bookingDetails('b1'))._pending).toBeUndefined();
  });

  it('sends one request for a double tap', async () => {
    seedBooking('pending');
    const call = deferred();
    (api.post as jest.Mock).mockReturnValue(call.promise);

    const first = runOperation(qc, confirmBookingOp, { bookingId: 'b1' });
    const second = runOperation(qc, confirmBookingOp, { bookingId: 'b1' });
    await expect(second).rejects.toThrow('already in progress');
    // A caller that opts in shares the in-flight result instead.
    const joined = runOperation(qc, confirmBookingOp, { bookingId: 'b1' }, { joinDuplicate: true });

    call.resolve(true);
    await Promise.all([first, joined]);
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it('runs operations on the same booking in the order issued', async () => {
    seedBooking('pending');
    const accept = deferred();
    const cancel = deferred();
    const order: string[] = [];
    (api.post as jest.Mock).mockImplementation((url: string) => {
      order.push(url);
      return url.endsWith('/confirm') ? accept.promise : cancel.promise;
    });

    const p1 = runOperation(qc, confirmBookingOp, { bookingId: 'b1' });
    const p2 = runOperation(qc, cancelBookingOp, { bookingId: 'b1', reason: 'User cancelled' });
    await waitFor(() => expect(order).toEqual(['/bookings/b1/confirm']));
    // The cancel is queued behind the accept, not racing it.
    cancel.resolve(true);
    await new Promise((r) => setTimeout(r, 10));
    expect(order).toEqual(['/bookings/b1/confirm']);

    accept.resolve(true);
    await Promise.all([p1, p2]);
    expect(order).toEqual(['/bookings/b1/confirm', '/bookings/b1/cancel']);
    // The latest intent wins.
    expect(statuses()).toEqual(['cancelled', 'cancelled', 'cancelled']);
  });

  it('finishes and reconciles after the screen that started it unmounts', async () => {
    seedBooking('confirmed');
    const call = deferred();
    (api.post as jest.Mock).mockReturnValue(call.promise);
    const events: FeedbackEvent[] = [];
    const unsubscribe = subscribeFeedback((e) => events.push(e));

    let run!: ReturnType<typeof useOperation<any, any, any>>['run'];
    const Screen = () => {
      run = useOperation(cancelBookingOp).run;
      return <Text>screen</Text>;
    };
    const view = render(
      <QueryClientProvider client={qc}>
        <Screen />
      </QueryClientProvider>,
    );
    let result: Promise<any>;
    act(() => {
      result = run({ bookingId: 'b1', reason: 'User cancelled' }).catch(() => {});
    });
    view.unmount();

    call.resolve(true);
    await act(async () => {
      await result;
    });
    expect(statuses()).toEqual(['cancelled', 'cancelled', 'cancelled']);
    expect(events.map((e) => e.kind)).toEqual(['success']);
    unsubscribe();
  });

  it('reports a failure through the banner with Retry once the screen is gone', async () => {
    seedBooking('confirmed');
    (api.post as jest.Mock).mockRejectedValueOnce(new Error('Network request failed')).mockResolvedValue(true);
    const events: FeedbackEvent[] = [];
    const unsubscribe = subscribeFeedback((e) => events.push(e));

    await expect(
      runOperation(qc, cancelBookingOp, { bookingId: 'b1', reason: 'User cancelled' }, { isHandledByCaller: () => false }),
    ).rejects.toThrow();
    expect(statuses()).toEqual(['confirmed', 'confirmed', 'confirmed']);
    expect(events[0]).toMatchObject({ kind: 'error', title: 'Could not cancel booking', message: 'Network request failed' });

    events[0].retry!();
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
    unsubscribe();
  });
});

describe('create operations', () => {
  const rideVars = {
    vehicleId: 'v1',
    from: { address: 'A', coordinates: { latitude: 1, longitude: 1 } },
    to: { address: 'B', coordinates: { latitude: 2, longitude: 2 } },
    date: '2026-10-01',
    time: '09:00',
    price: 200,
    totalSeats: 3,
  };

  it('sends one POST /rides for repeated taps on Create Ride', async () => {
    const call = deferred();
    (api.post as jest.Mock).mockReturnValue(call.promise);
    const a = runOperation(qc, createRideOp, rideVars);
    const b = runOperation(qc, createRideOp, { ...rideVars });
    await expect(b).rejects.toThrow('already in progress');
    call.resolve({ id: 'server-ride-id' });
    await expect(a).resolves.toEqual({ id: 'server-ride-id' });
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it('a retry after a timeout does not create the ride twice if it already landed', async () => {
    (api.post as jest.Mock).mockRejectedValueOnce(new Error('Request Timeout'));
    await expect(runOperation(qc, createRideOp, rideVars)).rejects.toThrow('Request Timeout');

    // The server did commit it: it is in My Rides now.
    (api.get as jest.Mock).mockImplementation(async (url: string) =>
      url === '/rides/my-rides'
        ? [{ ...ride, id: 'server-ride-id', status: 'published', from: { address: 'A' }, to: { address: 'B' }, date: '2026-10-01', time: '09:00' }]
        : [],
    );
    const retried = await runOperation(qc, createRideOp, createRideOp.prepareRetry!(rideVars));
    expect(retried).toEqual({ id: 'server-ride-id' });
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it('a retry still creates the booking when the first attempt did not land', async () => {
    const vars = { rideId: 'r1', seats: 1, passengerName: 'P', passengerPhone: '1' };
    (api.post as jest.Mock).mockRejectedValueOnce(new Error('Request Timeout')).mockResolvedValue({ bookingId: 'b9' });
    await expect(runOperation(qc, createBookingOp, vars)).rejects.toThrow();
    (api.get as jest.Mock).mockResolvedValue([]);
    await runOperation(qc, createBookingOp, createBookingOp.prepareRetry!(vars));
    expect(api.post).toHaveBeenCalledTimes(2);
  });
});

describe('API contract regression: operations send the same requests as before', () => {
  beforeEach(() => {
    (api.post as jest.Mock).mockResolvedValue({});
    (api.put as jest.Mock).mockResolvedValue({});
  });

  it.each([
    ['confirm booking', confirmBookingOp, { bookingId: 'b1' }, ['/bookings/b1/confirm', {}]],
    ['complete booking', completeBookingOp, { bookingId: 'b1' }, ['/bookings/b1/complete', {}]],
    ['cancel booking', cancelBookingOp, { bookingId: 'b1', reason: 'User cancelled' }, ['/bookings/b1/cancel', { reason: 'User cancelled' }]],
    ['decline booking', cancelBookingOp, { bookingId: 'b1', reason: 'Declined by driver' }, ['/bookings/b1/cancel', { reason: 'Declined by driver' }]],
    ['verify OTP', verifyBookingOp, { bookingId: 'b1', data: { verificationType: 'OTP', otp: '1234' } }, ['/bookings/b1/verify', { verificationType: 'OTP', otp: '1234' }]],
    ['cancel ride', cancelRideOp, { rideId: 'r1', reason: 'Cancelled by driver' }, ['/rides/r1/cancel', { reason: 'Cancelled by driver' }]],
    ['start ride', rideTransitionOp, { rideId: 'r1', action: 'start' }, ['/rides/r1/start', {}]],
    ['begin drop-off', rideTransitionOp, { rideId: 'r1', action: 'dropoff' }, ['/rides/r1/dropoff', {}]],
    ['override', rideTransitionOp, { rideId: 'r1', action: 'override', targetStatus: 4, reason: 'GPS signals blocked/delayed' },
      ['/rides/r1/override?targetStatus=4&reason=GPS%20signals%20blocked%2Fdelayed', {}]],
  ])('%s', async (_name, def: any, vars: any, expected: any[]) => {
    await runOperation(qc, def, vars);
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith(...expected);
  });

  it('drop-off: reach-drop then complete for a boarded passenger, complete only when already ReadyForDrop', async () => {
    await runOperation(qc, dropOffBookingOp, { bookingId: 'b1', currentStatus: 'boarded' });
    expect((api.post as jest.Mock).mock.calls.map((c) => c[0])).toEqual(['/bookings/b1/reach-drop', '/bookings/b1/complete']);

    (api.post as jest.Mock).mockClear();
    await runOperation(qc, dropOffBookingOp, { bookingId: 'b1', currentStatus: 'readyfordrop' });
    expect((api.post as jest.Mock).mock.calls.map((c) => c[0])).toEqual(['/bookings/b1/complete']);
  });

  it('create booking payload is unchanged', async () => {
    await runOperation(qc, createBookingOp, {
      rideId: 'r1', seats: 2, passengerName: 'P', passengerPhone: '9', specialRequest: '{"notes":""}',
      rideSummary: { from: 'A', to: 'B', date: 'd', time: 't', price: 1 },
    });
    expect(api.post).toHaveBeenCalledWith('/bookings', {
      rideId: 'r1', seats: 2, passengerName: 'P', passengerPhone: '9', specialRequest: '{"notes":""}', acceptTerms: true,
    });
  });

  it('create ride payload is unchanged', async () => {
    await runOperation(qc, createRideOp, {
      vehicleId: 'v1',
      from: { address: 'A', coordinates: { latitude: 1, longitude: 2 } },
      to: { address: 'B', coordinates: { latitude: 3, longitude: 4 } },
      date: '2026-10-01', time: '09:00', price: 250, totalSeats: 3,
      preferences: { musicAllowed: false, nonSmoking: true, petsAllowed: true, conversationLevel: 'quiet' },
    });
    expect(api.post).toHaveBeenCalledWith('/rides', {
      vehicleId: 'v1', fromAddress: 'A', fromLat: 1, fromLng: 2, toAddress: 'B', toLat: 3, toLng: 4,
      departureTime: '2026-10-01T09:00:00Z', pricePerSeat: 250, totalSeats: 3,
      allowMusic: false, allowSmoking: false, allowPets: true, conversationLevel: 0,
    });
  });
});
