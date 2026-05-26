# Test Case: TC-PERF-001 - Latency & Concurrency

## Description
Evaluate the response times for key API endpoints and verify that the system correctly handles concurrent booking attempts for the last remaining seat (Race Condition check).

## Steps
1. **Latency Measurement**: Use `Measure-Command` or `time` to record response times for:
   - Auth Login
   - Ride Search (with filters)
   - Profile Retrieval
2. **Concurrency/Race Condition Test**:
   - Create a ride with 1 available seat.
   - Simulate two simultaneous booking requests for that same seat.
   - Verify that only one booking succeeds and the other receives a `400 Bad Request` or appropriate error.

## Expected Results
- Latency for single requests should be < 200ms (Gateway overhead included).
- Race condition test must result in exactly one successful booking; no overbooking allowed.

## Status
- IN_PROGRESS
