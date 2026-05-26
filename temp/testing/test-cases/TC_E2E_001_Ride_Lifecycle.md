# Test Case: TC-E2E-001 - Full Ride Lifecycle

## Description
Verify the complete lifecycle of a ride from creation by a driver to completion by a passenger, ensuring all services (Ride, Booking, User) maintain consistent state.

## Pre-conditions
- All microservices are running.
- API Gateway is accessible.
- Valid Driver and Passenger accounts exist.

## Steps
1. **Login as Driver**: Obtain JWT for Kristopher35@yahoo.com.
2. **Create Ride**: Driver posts a new ride from "Central Station" to "Tech Park".
3. **Verify Ride**: Check RideService and Gateway for the new ride.
4. **Login as Passenger**: Obtain JWT for Pascale.Labadie18@yahoo.com.
5. **Search Ride**: Passenger searches for rides from "Central Station" to "Tech Park".
6. **Create Booking**: Passenger books 2 seats on the created ride.
7. **Verify Seat Deduction**: Check if available seats in RideService decreased by 2.
8. **Confirm Booking**: Driver confirms the pending booking.
9. **Complete Ride**: Driver marks the ride as "Started" then "Completed".
10. **Complete Booking**: Passenger/System marks the booking as "Completed".
11. **Verify History**: Ensure ride and booking appear in respective histories.

## Expected Results
- Ride status transitions: Scheduled -> Started -> Completed.
- Booking status transitions: Pending -> Confirmed -> Completed.
- Available seats correctly reflect real-time bookings.
- All services return consistent data via Gateway.

## Status
- NOT_STARTED
