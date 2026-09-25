import { QueryClient } from '@tanstack/react-query';
import { CACHE_KEYS, qk } from './cacheKeys';

/**
 * Every query that shows a ride or booking status. Invalidation only refetches
 * the ones currently on screen; the rest are marked stale and refetch when a
 * screen next mounts them. Ride search results are left alone.
 */
const STATUS_QUERY_KEYS = [
  qk.activeRides(),
  qk.myRides(),
  [CACHE_KEYS.rideDetails],
  [CACHE_KEYS.bookings],
  [CACHE_KEYS.rideBookings],
  [CACHE_KEYS.activeRide],
] as const;

export function invalidateStatusQueries(qc: QueryClient) {
  return Promise.all(STATUS_QUERY_KEYS.map((queryKey) => qc.invalidateQueries({ queryKey })));
}

/**
 * Turns realtime "something changed" signals into cache invalidation. The REST
 * API stays the source of truth: signals are never applied as state, so a
 * duplicate, late or out-of-order signal just causes one more refetch of the
 * current state. Bursts (a bulk ride transition moves every booking at once)
 * collapse into a single refetch.
 */
export function createRealtimeSync(qc: QueryClient, options: { debounceMs?: number } = {}) {
  const debounceMs = options.debounceMs ?? 250;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    timer = null;
    // An operation in flight reconciles on settle; refetching under it would
    // race its optimistic state, so wait for it (same rule as the poll hooks).
    if (qc.isMutating() > 0) {
      schedule();
      return;
    }
    void invalidateStatusQueries(qc);
  };

  const schedule = () => {
    if (timer) return;
    timer = setTimeout(flush, debounceMs);
  };

  return {
    /** A RideChanged or BookingChanged signal arrived. */
    notifyChanged: schedule,
    /** Signals may have been missed (reconnect, foreground, fallback tick). */
    resync: schedule,
    dispose() {
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}

export type RealtimeSync = ReturnType<typeof createRealtimeSync>;
