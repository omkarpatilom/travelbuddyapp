import { getDriverRideAction, RIDE_STATUS } from '@/utils/rideStatus';

describe('getDriverRideAction', () => {
  it.each([
    [RIDE_STATUS.PUBLISHED, false, 'awaitBookings'],
    [RIDE_STATUS.PUBLISHED, true, 'start'],
    [RIDE_STATUS.SCHEDULED, false, 'start'],
    [RIDE_STATUS.SCHEDULED, true, 'start'],
    // Regression: JourneyStarted with accepted bookings used to show Start Journey
    // *and* Resume Ride in Command Center.
    [RIDE_STATUS.JOURNEY_STARTED, true, 'resume'],
    [RIDE_STATUS.JOURNEY_STARTED, false, 'resume'],
    [RIDE_STATUS.ARRIVED_AT_PICKUP, true, 'resume'],
    [RIDE_STATUS.BOARDING, true, 'resume'],
    [RIDE_STATUS.IN_TRANSIT, true, 'resume'],
    [RIDE_STATUS.ARRIVED_AT_DESTINATION, true, 'resume'],
    [RIDE_STATUS.DROP_OFF, true, 'resume'],
    [RIDE_STATUS.COMPLETED, true, 'ended'],
    [RIDE_STATUS.CANCELLED, false, 'ended'],
  ])('%s (accepted bookings: %s) → %s', (status, hasBookings, expected) => {
    expect(getDriverRideAction(status, hasBookings)).toBe(expected);
  });

  it('accepts server casing and ignores unknown statuses', () => {
    expect(getDriverRideAction('JourneyStarted', true)).toBe('resume');
    expect(getDriverRideAction('Mystery', true)).toBeNull();
  });
});
