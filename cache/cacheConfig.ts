export const CACHE_TTL = {
  RIDE_SEARCH: 5 * 60 * 1000,       // 5 minutes
  RIDE_DETAILS: 2 * 60 * 1000,      // 2 minutes
  NOTIFICATIONS: 1 * 60 * 1000,     // 1 minute
  USER_PROFILE: 24 * 60 * 60 * 1000, // 24 hours
  VEHICLE_DATA: 24 * 60 * 60 * 1000, // 24 hours
  DEFAULT_STALE: 5 * 60 * 1000,     // 5 minutes default
  DEFAULT_GC: 30 * 60 * 1000,       // 30 minutes garbage collection
} as const;
