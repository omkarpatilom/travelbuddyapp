import { useQuery, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { rideService } from '../services/ride.service';
import { reviewService } from '../services/review.service';
import { sqliteStorage } from '../storage/sqlite';
import { CACHE_KEYS, qk } from '../cache/cacheKeys';
import { CACHE_TTL } from '../cache/cacheConfig';
import { mapRideData, Ride } from '../utils/mappers';
import { ConversationLevel } from '../utils/types';
import { RIDE_STATUS } from '../utils/rideStatus';
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

// ─── Queries ─────────────────────────────────────────────────────────────────

const mapRides = async (list: any[]) =>
  (await Promise.all(list.map(mapRideData))).map((r) => applyOverlays('ride', r));

export function useActiveRidesQuery() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.activeRides(),
    queryFn: async () => mapRides(await rideService.getActiveRides()),
    staleTime: CACHE_TTL.RIDE_SEARCH,
    gcTime: CACHE_TTL.DEFAULT_GC,
    enabled: !!user,
  });
}

export async function fetchMyRides(): Promise<Ride[]> {
  return mapRides(await rideService.getMyRides());
}

export function useMyRidesQuery() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.myRides(),
    queryFn: fetchMyRides,
    staleTime: 0,
    refetchOnMount: 'always',
    enabled: !!user && (user.role === 'Driver' || user.role === 'Admin'),
  });
}

export async function fetchRideDetails(id: string): Promise<Ride> {
  const ride = await rideService.getRideById(id);
  return applyOverlays('ride', await mapRideData(ride));
}

/**
 * One ride, shared by Ride Details, Booking flow and the Command Center.
 * `pollMs` keeps it fresh while `pollWhile(ride)` holds (the backend moves a
 * running journey through geofence transitions on its own).
 */
export function useRideDetailsQuery(
  id: string,
  options: { pollMs?: number | false; pollWhile?: (ride: Ride | undefined) => boolean } = {},
) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { pollMs, pollWhile } = options;
  return useQuery({
    queryKey: qk.rideDetails(id),
    queryFn: () => fetchRideDetails(id),
    staleTime: pollMs ? 0 : CACHE_TTL.RIDE_DETAILS,
    refetchOnMount: 'always',
    enabled: !!user && !!id,
    refetchInterval: (query) => {
      if (!pollMs) return false;
      if (pollWhile && !pollWhile(query.state.data)) return false;
      // Skip a tick while a mutation is running; it reconciles on settle.
      return qc.isMutating() > 0 ? false : pollMs;
    },
  });
}

export function useSearchRides(params: {
  from: string;
  to: string;
  date: string;
  fromCoords?: { latitude: number; longitude: number };
  toCoords?: { latitude: number; longitude: number };
  seats?: number;
  maxPrice?: number;
  allowPets?: boolean;
  allowMusic?: boolean;
}) {
  const { user } = useAuth();
  const searchKey = `${params.from}_${params.to}_${params.date}`;

  return useQuery({
    queryKey: [CACHE_KEYS.rides, 'search', searchKey],
    queryFn: async () => {
      const netState = await NetInfo.fetch();

      if (params.from && params.to) {
        try {
          await sqliteStorage.addSearchHistory(`${params.from} to ${params.to}`);
        } catch (e) {
          console.warn('Failed to save search history', e);
        }
      }

      if (!netState.isConnected) {
        const cached = await sqliteStorage.getCachedRides(searchKey);
        if (cached) {
          return cached as Ride[];
        }
        throw new Error('No internet connection. No cached results available.');
      }

      const apiResults = await rideService.searchRides({
        From: params.from,
        To: params.to,
        Date: params.date,
        FromCoords: params.fromCoords,
        ToCoords: params.toCoords,
        Seats: params.seats,
        MaxPrice: params.maxPrice,
        AllowPets: params.allowPets,
        AllowMusic: params.allowMusic
      });

      const mapped = await Promise.all(apiResults.map(mapRideData));

      try {
        await sqliteStorage.cacheRides(searchKey, mapped);
      } catch (e) {
        console.warn('Failed to cache rides in SQLite', e);
      }

      return mapped;
    },
    staleTime: CACHE_TTL.RIDE_SEARCH,
    enabled: !!user && !!params.from && !!params.to && !!params.date,
  });
}

// ─── Operations ──────────────────────────────────────────────────────────────

/** The form payload offer.tsx builds (unchanged shape). */
export interface CreateRideVars {
  vehicleId: string;
  from: { address: string; coordinates: { latitude: number; longitude: number } };
  to: { address: string; coordinates: { latitude: number; longitude: number } };
  date: string;
  time: string;
  price: number;
  totalSeats: number;
  preferences?: any;
  [extra: string]: any;
  /** Set on a user retry: check whether the earlier attempt already created it. */
  isRetry?: boolean;
}

/** Exactly the request the app has always sent for POST /rides. */
export function buildCreateRideCommand(rideData: CreateRideVars) {
  const departureTime = `${rideData.date}T${rideData.time}:00Z`;
  return {
    vehicleId: rideData.vehicleId,
    fromAddress: rideData.from.address,
    fromLat: rideData.from.coordinates.latitude,
    fromLng: rideData.from.coordinates.longitude,
    toAddress: rideData.to.address,
    toLat: rideData.to.coordinates.latitude,
    toLng: rideData.to.coordinates.longitude,
    departureTime,
    pricePerSeat: rideData.price,
    totalSeats: rideData.totalSeats,
    allowMusic: rideData.preferences?.musicAllowed ?? true,
    allowSmoking: !rideData.preferences?.nonSmoking,
    allowPets: rideData.preferences?.petsAllowed ?? false,
    conversationLevel: rideData.preferences?.conversationLevel === 'quiet' ? ConversationLevel.Quiet :
                      rideData.preferences?.conversationLevel === 'chatty' ? ConversationLevel.Chatty : ConversationLevel.Moderate
  };
}

const createRideKey = (v: CreateRideVars) =>
  [v.vehicleId, v.date, v.time, v.from.address, v.to.address].join('|');

/**
 * Server-authoritative create. No ride is invented locally: My Rides shows a
 * "Creating ride…" card from this mutation's variables until the server
 * returns the real ride. The backend has no idempotency key, so a retry first
 * checks whether the earlier attempt already created the ride (a client
 * timeout does not mean the server did not commit it).
 */
export const createRideOp: OperationDef<CreateRideVars, { id: string }> = {
  op: 'createRide',
  key: createRideKey,
  errorTitle: 'Ride was not created',
  backgroundSuccess: 'Your ride has been posted successfully!',
  gcTime: 30 * 60 * 1000,
  prepareRetry: (v) => ({ ...v, isRetry: true }),
  mutationFn: async (v) => {
    if (v.isRetry) {
      const existing = await findMatchingRide(v);
      if (existing) return { id: existing.id };
    }
    return rideService.createRide(buildCreateRideCommand(v));
  },
  // Awaited so the pending card only disappears once My Rides has the real ride.
  onSettled: (_v, qc) => qc.invalidateQueries({ queryKey: [CACHE_KEYS.rides] }),
};

async function findMatchingRide(v: CreateRideVars) {
  try {
    const mine = await fetchMyRides();
    return mine.find(
      (r) =>
        r.status !== RIDE_STATUS.CANCELLED &&
        r.date === v.date &&
        r.time === v.time &&
        r.from.address === v.from.address &&
        r.to.address === v.to.address,
    ) ?? null;
  } catch {
    return null;
  }
}

type RideRef = { rideId: string };

/**
 * Optimistic: the ride shows Cancelled in every list/detail straight away.
 * The server cascades the cancel to its bookings, so those are refetched when
 * it settles; on failure the ride is restored.
 */
export const cancelRideOp: OperationDef<RideRef & { reason: string }, unknown, EntitySnapshot> = {
  op: 'cancelRide',
  key: (v) => v.rideId,
  scope: (v) => `ride:${v.rideId}`,
  errorTitle: 'Could not cancel ride',
  backgroundSuccess: 'Ride cancelled.',
  mutationFn: (v) => rideService.cancelRide(v.rideId, v.reason),
  onMutate: async (v, qc) => {
    await cancelEntityQueries(qc, 'ride');
    return patchEntity(qc, 'ride', v.rideId, {
      status: RIDE_STATUS.CANCELLED,
      _pending: { op: 'cancelRide', label: 'Cancelling…' },
    });
  },
  onSuccess: (_d, _v, snap, qc) => commitEntity(qc, snap, { status: RIDE_STATUS.CANCELLED }),
  onError: (_e, _v, snap, qc) => {
    if (snap) rollbackEntity(qc, snap);
  },
  onSettled: async (v, qc) => {
    await invalidateEntity(qc, 'ride', v.rideId);
    await invalidateEntity(qc, 'booking', v.rideId);
  },
};

export type RideTransition =
  | { action: 'start' }
  | { action: 'arrivePickup'; lat?: number; lng?: number }
  | { action: 'boarding' }
  | { action: 'enRoute' }
  | { action: 'arriveDrop'; lat?: number; lng?: number }
  | { action: 'dropoff' }
  | { action: 'complete' }
  | { action: 'override'; targetStatus: number; reason: string }
  | { action: 'completeStop'; stopId: string }
  | { action: 'publish' };

export type RideTransitionVars = RideRef & RideTransition;

const TRANSITION_LABEL: Record<RideTransition['action'], string> = {
  start: 'Starting journey…',
  arrivePickup: 'Marking arrival…',
  boarding: 'Starting boarding…',
  enRoute: 'Updating…',
  arriveDrop: 'Marking arrival…',
  dropoff: 'Starting drop-off…',
  complete: 'Completing ride…',
  override: 'Applying override…',
  completeStop: 'Completing stop…',
  publish: 'Publishing…',
};

/** Status the server is guaranteed to report after a successful call, when fixed. */
const TRANSITION_RESULT: Partial<Record<RideTransition['action'], string>> = {
  start: RIDE_STATUS.JOURNEY_STARTED,
  complete: RIDE_STATUS.COMPLETED,
};

function callTransition(v: RideTransitionVars): Promise<unknown> {
  switch (v.action) {
    case 'start': return rideService.startRide(v.rideId);
    case 'arrivePickup': return rideService.arriveAtPickup(v.rideId, v.lat, v.lng);
    case 'boarding': return rideService.startBoarding(v.rideId);
    case 'enRoute': return rideService.transitionEnRoute(v.rideId);
    case 'arriveDrop': return rideService.arriveAtDrop(v.rideId, v.lat, v.lng);
    case 'dropoff': return rideService.completeDropoff(v.rideId);
    case 'complete': return rideService.completeRide(v.rideId);
    case 'override': return rideService.overrideTransition(v.rideId, v.targetStatus, v.reason);
    case 'completeStop': return rideService.completeStop(v.rideId, v.stopId);
    case 'publish': return rideService.publishRide(v.rideId);
  }
}

/**
 * Pending/processing: ride lifecycle steps are validated server-side (GPS
 * proximity, booking states), so the ride shows e.g. "Starting journey…"
 * and only moves to its next status once the server has accepted it. One
 * transition per ride at a time (the guard key is the ride id).
 */
export const rideTransitionOp: OperationDef<RideTransitionVars, unknown, EntitySnapshot> = {
  op: 'rideTransition',
  key: (v) => v.rideId,
  scope: (v) => `ride:${v.rideId}`,
  errorTitle: 'Ride update failed',
  retryable: false,
  mutationFn: callTransition,
  onMutate: async (v, qc) => {
    await cancelEntityQueries(qc, 'ride');
    return patchEntity(qc, 'ride', v.rideId, {
      _pending: { op: v.action, label: TRANSITION_LABEL[v.action] },
    });
  },
  onSuccess: (_d, v, snap, qc) => {
    const status = TRANSITION_RESULT[v.action];
    commitEntity(qc, snap, status ? { status } : {});
  },
  onError: (_e, _v, snap, qc) => {
    if (snap) rollbackEntity(qc, snap);
  },
  onSettled: async (v, qc) => {
    await Promise.all([
      invalidateEntity(qc, 'ride', v.rideId),
      qc.invalidateQueries({ queryKey: qk.rideBookings(v.rideId) }),
      v.action === 'complete' ? qc.invalidateQueries({ queryKey: [CACHE_KEYS.activeRide] }) : Promise.resolve(),
      v.action === 'complete' ? qc.invalidateQueries({ queryKey: [CACHE_KEYS.bookings] }) : Promise.resolve(),
    ]);
  },
};

export interface RateRideVars {
  rideId: string;
  bookingId: string;
  reviewedUserId: string;
  targetRole: 'driver' | 'passenger';
  rating: number;
  review: string;
}

/** Pending: one review per booking is enforced by the server. */
export const rateRideOp: OperationDef<RateRideVars> = {
  op: 'rateRide',
  key: (v) => `${v.bookingId}:${v.reviewedUserId}`,
  errorTitle: 'Review was not submitted',
  backgroundSuccess: 'Thanks for your review!',
  mutationFn: (v) =>
    reviewService.createReview({
      bookingId: v.bookingId,
      rideId: v.rideId,
      reviewedUserId: v.reviewedUserId,
      targetType: v.targetRole === 'driver' ? 0 : 1,
      rating: v.rating,
      comment: v.review,
      isAnonymous: false
    }),
  onSettled: (_v, qc) =>
    Promise.all([
      qc.invalidateQueries({ queryKey: [CACHE_KEYS.rides] }),
      // Every "already reviewed?" lookup (booking details, ride details) lives under `reviews`.
      qc.invalidateQueries({ queryKey: [CACHE_KEYS.reviews] }),
    ]),
};
