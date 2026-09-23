/**
 * rideStatus.ts
 *
 * Single source of truth for Ride and Booking status strings in the frontend.
 * These mirror the backend enum values serialised as lowercase strings via
 * System.Text.Json's JsonStringEnumConverter.
 *
 * Reference: docs/Tasks/Ride And Booking Life cycle.md §5, §7, §22
 */

// ─── Ride Status ─────────────────────────────────────────────────────────────

export const RIDE_STATUS = {
  PUBLISHED: 'published',
  SCHEDULED: 'scheduled',
  JOURNEY_STARTED: 'journeystarted',
  ARRIVED_AT_PICKUP: 'arrivedatpickup',
  BOARDING: 'boarding',
  IN_TRANSIT: 'intransit',
  ARRIVED_AT_DESTINATION: 'arrivedatdestination',
  DROP_OFF: 'dropoff',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export type RideStatusType = typeof RIDE_STATUS[keyof typeof RIDE_STATUS];

// ─── Booking Status ───────────────────────────────────────────────────────────

export const BOOKING_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  READY_FOR_BOARDING: 'readyforboarding',
  BOARDED: 'boarded',
  READY_FOR_DROP: 'readyfordrop',
  COMPLETED: 'completed',
  NO_SHOW: 'noshow',
} as const;

export type BookingStatusType = typeof BOOKING_STATUS[keyof typeof BOOKING_STATUS];

// ─── Status groups ────────────────────────────────────────────────────────────

/** Statuses where GPS tracking, polling, and command center HUD are active. */
export const ACTIVE_RIDE_STATUSES: RideStatusType[] = [
  RIDE_STATUS.JOURNEY_STARTED,
  RIDE_STATUS.ARRIVED_AT_PICKUP,
  RIDE_STATUS.BOARDING,
  RIDE_STATUS.IN_TRANSIT,
  RIDE_STATUS.ARRIVED_AT_DESTINATION,
  RIDE_STATUS.DROP_OFF,
];

/** Pre-departure statuses managed from the Ride Details screen. */
export const PRE_START_RIDE_STATUSES: RideStatusType[] = [
  RIDE_STATUS.PUBLISHED,
  RIDE_STATUS.SCHEDULED,
];

/** Terminal ride statuses — ride cannot progress further. */
export const TERMINAL_RIDE_STATUSES: RideStatusType[] = [
  RIDE_STATUS.COMPLETED,
  RIDE_STATUS.CANCELLED,
];

// ─── Predicates ───────────────────────────────────────────────────────────────

export const isRideActive = (s: string) => ACTIVE_RIDE_STATUSES.includes(s as RideStatusType);
export const isRidePreStart = (s: string) => PRE_START_RIDE_STATUSES.includes(s as RideStatusType);
export const isRideTerminal = (s: string) => TERMINAL_RIDE_STATUSES.includes(s as RideStatusType);

export const isBookingTerminal = (s: string) =>
  [BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CANCELLED,
  BOOKING_STATUS.REJECTED, BOOKING_STATUS.NO_SHOW].includes(s as BookingStatusType);

export const isBookingBoarded = (s: string) =>
  [BOOKING_STATUS.BOARDED, BOOKING_STATUS.READY_FOR_DROP,
  BOOKING_STATUS.COMPLETED].includes(s as BookingStatusType);

/**
 * Derived state "In Ride": booking is Boarded AND ride is InTransit.
 * NOT a stored status — derived only for display. (§9 of lifecycle spec)
 */
export const isInRide = (rideStatus: string, bookingStatus: string): boolean =>
  rideStatus === RIDE_STATUS.IN_TRANSIT && bookingStatus === BOOKING_STATUS.BOARDED;

/** Forward order of the booking lifecycle (§8, §20) — excludes terminal side-states. */
const BOOKING_PROGRESS_ORDER: BookingStatusType[] = [
  BOOKING_STATUS.PENDING,
  BOOKING_STATUS.CONFIRMED,
  BOOKING_STATUS.READY_FOR_BOARDING,
  BOOKING_STATUS.BOARDED,
  BOOKING_STATUS.READY_FOR_DROP,
  BOOKING_STATUS.COMPLETED,
];

const BOOKING_OVERRIDE_STATUSES: BookingStatusType[] = [
  BOOKING_STATUS.CANCELLED,
  BOOKING_STATUS.REJECTED,
  BOOKING_STATUS.NO_SHOW,
];

/**
 * Picks the more-authoritative of a freshly-fetched booking status and the
 * status already shown in the UI, so a slow/racing re-fetch (a 5s poll tick
 * that started before a Verify/Confirm call, or an immediate re-fetch right
 * after one that races the backend's own write) can't regress a booking back
 * to an earlier lifecycle stage than what the UI already confirmed.
 *
 * Override statuses (cancelled/rejected/noshow) can happen at any point and
 * always win. Otherwise, whichever status is further along the forward
 * lifecycle order wins.
 */
export const reconcileBookingStatus = (serverStatus: string, localStatus?: string): string => {
  const server = (serverStatus || '').toLowerCase();
  const local = (localStatus || '').toLowerCase();
  if (!local || local === server) return server;

  if (BOOKING_OVERRIDE_STATUSES.includes(server as BookingStatusType) ||
    BOOKING_OVERRIDE_STATUSES.includes(local as BookingStatusType)) {
    return server;
  }

  const serverRank = BOOKING_PROGRESS_ORDER.indexOf(server as BookingStatusType);
  const localRank = BOOKING_PROGRESS_ORDER.indexOf(local as BookingStatusType);
  if (serverRank === -1 || localRank === -1) return server;

  return localRank > serverRank ? local : server;
};

// ─── Display helpers ──────────────────────────────────────────────────────────

export const RIDE_STATUS_LABEL: Record<RideStatusType, string> = {
  published: 'Published',
  scheduled: 'Scheduled',
  journeystarted: 'Journey Started',
  arrivedatpickup: 'Arrived at Pickup',
  boarding: 'Boarding',
  intransit: 'In Transit',
  arrivedatdestination: 'Arrived at Destination',
  dropoff: 'Drop-Off',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const BOOKING_STATUS_LABEL: Record<BookingStatusType, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  readyforboarding: 'Ready to Board',
  boarded: 'Boarded',
  readyfordrop: 'Ready for Drop-Off',
  completed: 'Completed',
  noshow: 'No Show',
};

/** Derives display label, applying the "In Ride" derived state when applicable. */
export const getBookingDisplayLabel = (bookingStatus: string, rideStatus: string): string => {
  if (isInRide(rideStatus, bookingStatus)) return 'In Ride';
  return BOOKING_STATUS_LABEL[bookingStatus as BookingStatusType] ?? bookingStatus;
};
