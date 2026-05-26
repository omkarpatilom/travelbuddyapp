# Test Case: TC-SEC-001 - Unauthorized Access & Data Isolation

## Description
Verify that the system correctly enforces authentication and prevents users from accessing or modifying data that does not belong to them (IDOR - Insecure Direct Object Reference).

## Steps
1. **No Token Access**: Attempt to call `/api/v1/users/me` without any Authorization header.
2. **Invalid Token Access**: Attempt to call `/api/v1/users/me` with a malformed/invalid token.
3. **Cross-User Data Access**: 
   - Login as Driver (User A).
   - Login as Passenger (User B).
   - Attempt to retrieve User A's private profile data using User B's token.
4. **Cross-User Data Modification**:
   - User B attempts to cancel a booking belonging to User A.
5. **Admin Endpoint Protection**:
   - User B (Passenger role) attempts to call an admin-only endpoint (e.g., `/api/v1/admin/drivers/{id}/verify`).

## Expected Results
- All unauthorized requests must return `401 Unauthorized` or `403 Forbidden`.
- Users must only be able to access/modify their own resources.
- Admin endpoints must reject non-admin tokens.

## Status
- IN_PROGRESS
