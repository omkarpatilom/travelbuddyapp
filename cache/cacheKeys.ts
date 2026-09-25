export const CACHE_KEYS = {
  rides: 'rides',
  rideDetails: 'rideDetails',
  bookings: 'bookings',
  rideBookings: 'rideBookings',
  reviews: 'reviews',
  profile: 'profile',
  vehicles: 'vehicles',
  preferences: 'preferences',
  savedLocations: 'savedLocations',
  emergencyContacts: 'emergencyContacts',
  verificationStatus: 'verificationStatus',
  notifications: 'notifications',
  notificationSettings: 'notificationSettings',
  activeRide: 'activeRide',
  tripShare: 'tripShare',
} as const;

/**
 * Query key builders. Every screen that shows an entity reads it through one
 * of these keys, so a mutation that writes to them (cache/entityCache.ts)
 * updates every view of that entity at once.
 */
export const qk = {
  activeRides: () => [CACHE_KEYS.rides, 'active'] as const,
  myRides: () => [CACHE_KEYS.rides, 'my-rides'] as const,
  rideDetails: (rideId: string) => [CACHE_KEYS.rideDetails, rideId] as const,
  myBookings: () => [CACHE_KEYS.bookings, 'my'] as const,
  bookingDetails: (bookingId: string) => [CACHE_KEYS.bookings, bookingId] as const,
  rideBookings: (rideId: string) => [CACHE_KEYS.rideBookings, rideId] as const,
  bookingReview: (bookingId: string) => [CACHE_KEYS.reviews, 'booking', bookingId] as const,
  myVehicles: () => [CACHE_KEYS.vehicles, 'my'] as const,
  preferences: () => [CACHE_KEYS.preferences] as const,
  savedLocations: () => [CACHE_KEYS.savedLocations] as const,
  emergencyContacts: () => [CACHE_KEYS.emergencyContacts] as const,
  verificationStatus: () => [CACHE_KEYS.verificationStatus] as const,
  notifications: () => [CACHE_KEYS.notifications] as const,
  notificationSettings: () => [CACHE_KEYS.notificationSettings] as const,
  tripShare: (bookingId: string) => [CACHE_KEYS.tripShare, bookingId] as const,
};
