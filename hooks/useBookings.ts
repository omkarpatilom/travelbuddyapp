import { useQuery, useQueryClient, QueryClient } from '@tanstack/react-query';
import { bookingService } from '../services/booking.service';
import { reviewService } from '../services/review.service';
import { CACHE_KEYS, qk } from '../cache/cacheKeys';
import { mapBookingData, Booking } from '../utils/mappers';
import { useAuth } from '../contexts/AuthContext';
import {
  applyOverlays,
  cancelEntityQueries,
  commitEntity,
  EntitySnapshot,
  invalidateEntity,
  patchEntity,
  rollbackEntity,
} from '../cache/entityCache';
import { OperationDef } from './mutations/operations';
import { BOOKING_STATUS, isBookingTerminal, reconcileBookingStatus } from '../utils/rideStatus';
import { getRememberedBookingStatus, rememberConfirmedBookingStatus } from '../utils/bookingStatusMemory';

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function fetchMyBookings(): Promise<Booking[]> {
  const data = await bookingService.getMyBookings();
  const mapped = await Promise.all(data.map(mapBookingData));
  return mapped.map((b) => applyOverlays('booking', b));
}

export function useMyBookingsQuery() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.myBookings(),
    queryFn: fetchMyBookings,
    enabled: !!user,
  });
}

export function useBookingDetailsQuery(id: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.bookingDetails(id),
    queryFn: async () => {
      const data = await bookingService.getBookingById(id);
      return applyOverlays('booking', await mapBookingData(data));
    },
    enabled: !!user && !!id,
    staleTime: 0,
  });
}

/** Raw booking DTO as the driver screens use it: `id` normalised, status lower-cased. */
export type RideBooking = Record<string, any> & { id: string; status: string; seats: number };

/**
 * Passenger bookings on a ride, as the driver sees them (Ride Details and the
 * Command Center share this cache entry).
 *
 * Each status is reconciled against what was already cached and against the
 * durable "this app just confirmed X" memory, so a racing or read-lagged
 * response cannot move a booking backwards in its lifecycle (see
 * reconcileBookingStatus and utils/bookingStatusMemory.ts). This is the
 * reconciliation the Command Center previously did against its own state.
 */
export async function fetchRideBookings(qc: QueryClient, rideId: string): Promise<RideBooking[]> {
  const list = await bookingService.getRideBookings(rideId);
  const prior = qc.getQueryData<RideBooking[]>(qk.rideBookings(rideId)) ?? [];
  return Promise.all(
    (list || []).map(async (b: any) => {
      const id = b.bookingId || b.id;
      const serverStatus = (b.status || '').toLowerCase();
      const priorMatch = prior.find((pb) => pb.id === id);
      const remembered = await getRememberedBookingStatus(id);
      const status = reconcileBookingStatus(
        reconcileBookingStatus(serverStatus, priorMatch?.status),
        remembered,
      );
      return applyOverlays('booking', { ...b, id, status } as RideBooking);
    }),
  );
}

export function useRideBookingsQuery(rideId: string, options: { enabled?: boolean; pollMs?: number | false } = {}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.rideBookings(rideId),
    queryFn: () => fetchRideBookings(qc, rideId),
    enabled: !!user && !!rideId && (options.enabled ?? true),
    staleTime: 0,
    // Skip a poll tick while any mutation is running; it reconciles on settle.
    refetchInterval: options.pollMs ? () => (qc.isMutating() > 0 ? false : (options.pollMs as number)) : false,
  });
}

/** Whether a booking already has a review (used for "Rate" buttons). */
export function useBookingReviewedQuery(bookingId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: qk.bookingReview(bookingId ?? ''),
    queryFn: async () => {
      try {
        const rev = await reviewService.getByBookingId(bookingId!);
        return !!rev;
      } catch {
        return false;
      }
    },
    enabled: !!bookingId && enabled,
  });
}

// ─── Operations ──────────────────────────────────────────────────────────────

type BookingRef = { bookingId: string; rideId?: string };

const pendingPatch = (op: string, label: string) => ({ _pending: { op, label } });

/**
 * Pending/processing: the booking shows `label` straight away; its status only
 * changes once the server confirms, because the backend can refuse (seat
 * limits, ride state).
 */
function pendingBookingOp<V extends BookingRef>(config: {
  op: string;
  label: string;
  errorTitle: string;
  call: (vars: V) => Promise<unknown>;
  confirmedStatus?: string;
  remember?: boolean;
  backgroundSuccess?: string;
  retryable?: boolean;
}): OperationDef<V, unknown, EntitySnapshot> {
  return {
    op: config.op,
    key: (v) => v.bookingId,
    scope: (v) => `booking:${v.bookingId}`,
    errorTitle: config.errorTitle,
    backgroundSuccess: config.backgroundSuccess,
    retryable: config.retryable,
    mutationFn: config.call,
    onMutate: async (v, qc) => {
      await cancelEntityQueries(qc, 'booking');
      return patchEntity(qc, 'booking', v.bookingId, pendingPatch(config.op, config.label));
    },
    onSuccess: async (_d, v, snap, qc) => {
      if (config.remember && config.confirmedStatus) {
        await rememberConfirmedBookingStatus(v.bookingId, config.confirmedStatus);
      }
      commitEntity(qc, snap, config.confirmedStatus ? { status: config.confirmedStatus } : {});
    },
    onError: (_e, _v, snap, qc) => {
      if (snap) rollbackEntity(qc, snap);
    },
    onSettled: (v, qc) => invalidateEntity(qc, 'booking', v.rideId),
  };
}

export const confirmBookingOp = pendingBookingOp<BookingRef>({
  op: 'confirmBooking',
  label: 'Accepting…',
  errorTitle: 'Could not accept booking',
  call: (v) => bookingService.confirmBooking(v.bookingId),
  confirmedStatus: BOOKING_STATUS.CONFIRMED,
  remember: true,
  backgroundSuccess: 'Booking accepted.',
});

export const completeBookingOp = pendingBookingOp<BookingRef>({
  op: 'completeBooking',
  label: 'Completing…',
  errorTitle: 'Could not complete booking',
  call: (v) => bookingService.completeBooking(v.bookingId),
  confirmedStatus: BOOKING_STATUS.COMPLETED,
  remember: true,
  backgroundSuccess: 'Drop-off confirmed.',
});

/**
 * Driver drop-off: marks the passenger at the drop point, then completes the
 * booking — the same calls, conditions and order the Command Center used
 * before. A reach-drop failure is tolerated exactly as before.
 */
export const dropOffBookingOp = pendingBookingOp<BookingRef & { currentStatus?: string }>({
  op: 'dropOffBooking',
  label: 'Completing drop-off…',
  errorTitle: 'Could not confirm drop-off',
  call: async (v) => {
    // A booking can only be completed from ReadyForDrop. That transition normally
    // happens when the destination geofence fires, but GPS lag or an early drop
    // leaves the passenger Boarded, so move them to the drop point explicitly first.
    if ((v.currentStatus || '').toLowerCase() !== BOOKING_STATUS.READY_FOR_DROP) {
      try {
        await bookingService.reachDrop(v.bookingId);
      } catch (e) {
        // Already past this step or not applicable; completion below reports real failures.
        console.warn('[DropConfirm] reach-drop skipped:', e);
      }
    }
    return bookingService.completeBooking(v.bookingId);
  },
  confirmedStatus: BOOKING_STATUS.COMPLETED,
  remember: true,
  backgroundSuccess: 'Drop-off confirmed.',
});

type VerifyVars = BookingRef & { data: { verificationType: 'OTP' | 'QR'; otp?: string; qrToken?: string } };

/** Server-authoritative: identity check. Status changes only after the server accepts the code. */
export const verifyBookingOp = pendingBookingOp<VerifyVars>({
  op: 'verifyBooking',
  label: 'Verifying…',
  errorTitle: 'Verification failed',
  call: (v) => bookingService.verifyBooking(v.bookingId, v.data),
  confirmedStatus: BOOKING_STATUS.BOARDED,
  remember: true,
  // A rejected OTP must not be replayed from the banner.
  retryable: false,
});

type CancelVars = BookingRef & { reason: string; label?: string };

/**
 * Optimistic: cancellation is shown immediately everywhere the booking
 * appears and rolled back if the server refuses it.
 */
export const cancelBookingOp: OperationDef<CancelVars, unknown, EntitySnapshot> = {
  op: 'cancelBooking',
  key: (v) => v.bookingId,
  scope: (v) => `booking:${v.bookingId}`,
  errorTitle: 'Could not cancel booking',
  backgroundSuccess: 'Booking cancelled.',
  mutationFn: (v) => bookingService.cancelBooking(v.bookingId, v.reason),
  onMutate: async (v, qc) => {
    await cancelEntityQueries(qc, 'booking');
    return patchEntity(qc, 'booking', v.bookingId, {
      status: BOOKING_STATUS.CANCELLED,
      ...pendingPatch('cancelBooking', v.label ?? 'Cancelling…'),
    });
  },
  onSuccess: (_d, _v, snap, qc) => commitEntity(qc, snap, { status: BOOKING_STATUS.CANCELLED }),
  onError: (_e, _v, snap, qc) => {
    if (snap) rollbackEntity(qc, snap);
  },
  onSettled: (v, qc) => invalidateEntity(qc, 'booking', v.rideId),
};

export interface CreateBookingVars {
  rideId: string;
  seats: number;
  passengerName: string;
  passengerPhone: string;
  specialRequest?: string;
  /** Snapshot of the ride for the pending card in My Bookings. */
  rideSummary?: { from: string; to: string; date: string; time: string; price: number };
  /** Set on a user retry: check whether the earlier attempt already created it. */
  isRetry?: boolean;
}

/**
 * Server-authoritative create. The booking (and its id) only appears once the
 * server creates it; until then My Bookings shows a pending card built from
 * the mutation's variables. There is no idempotency key on the backend, so a
 * retry first looks for an active booking on the same ride — a request that
 * timed out on the client may still have succeeded on the server.
 */
export const createBookingOp: OperationDef<CreateBookingVars, { bookingId?: string } | unknown> = {
  op: 'createBooking',
  // One booking request per ride at a time, whatever the seat count.
  key: (v) => v.rideId,
  errorTitle: 'Booking failed',
  backgroundSuccess: 'Your booking request was sent.',
  gcTime: 30 * 60 * 1000,
  prepareRetry: (v) => ({ ...v, isRetry: true }),
  mutationFn: async (v) => {
    if (v.isRetry) {
      const existing = await findActiveBookingForRide(v.rideId);
      if (existing) return { bookingId: existing.id };
    }
    return bookingService.createBooking({
      rideId: v.rideId,
      seats: v.seats,
      passengerName: v.passengerName,
      passengerPhone: v.passengerPhone,
      specialRequest: v.specialRequest,
      acceptTerms: true,
    });
  },
  onSettled: async (v, qc) => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: [CACHE_KEYS.bookings] }),
      qc.invalidateQueries({ queryKey: [CACHE_KEYS.rides] }),
      qc.invalidateQueries({ queryKey: [CACHE_KEYS.rideDetails, v.rideId] }),
    ]);
  },
};

async function findActiveBookingForRide(rideId: string) {
  try {
    const mine = await bookingService.getMyBookings();
    const match = (mine || []).find(
      (b: any) => b.rideId === rideId && !isBookingTerminal((b.status || '').toLowerCase()),
    );
    return match ? { id: (match as any).bookingId } : null;
  } catch {
    return null;
  }
}
