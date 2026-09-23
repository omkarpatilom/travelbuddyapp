/**
 * bookingStatusMemory.ts
 *
 * Durable, short-lived memory of a booking status the driver app itself just
 * confirmed via a successful action (Verify, Confirm drop-off, Accept).
 *
 * Why this exists: `reconcileBookingStatus` (rideStatus.ts) already prevents
 * an in-flight poll response from regressing a booking's displayed status
 * within the same app session, using an in-memory ref. That protection is
 * lost on a full page refresh (web) or app relaunch, since all React state
 * resets to empty. If the very next fetch after such a refresh still returns
 * a not-yet-updated status — whether from backend read-after-write lag or
 * any other transient cause — the UI has no memory to reconcile against and
 * shows the regression (e.g. "Boarded" reverting to "Verify").
 *
 * Persisting "the app itself just confirmed X" to AsyncStorage (localStorage
 * on web) closes that gap: it survives the refresh, and loadData() reconciles
 * against it the same way it reconciles against in-memory state.
 *
 * This is a floor, not a source of truth — it only ever wins when it's
 * *further along* the lifecycle than a fresh read (via reconcileBookingStatus),
 * so a legitimate later change (NoShow, cancellation, admin override) is never
 * masked. It also expires after GRACE_PERIOD_MS so a stale entry can't linger
 * forever if the backend genuinely never persisted the change.
 */
import { storage } from './storage';

const KEY_PREFIX = 'confirmedBookingStatus:';
const GRACE_PERIOD_MS = 30 * 60 * 1000; // 30 minutes

interface ConfirmedEntry {
  status: string;
  confirmedAt: number;
}

export const rememberConfirmedBookingStatus = async (bookingId: string, status: string): Promise<void> => {
  try {
    await storage.setItem(`${KEY_PREFIX}${bookingId}`, { status, confirmedAt: Date.now() } as ConfirmedEntry);
  } catch {
    // Best-effort only — reconciliation still falls back to the server value.
  }
};

export const getRememberedBookingStatus = async (bookingId: string): Promise<string | undefined> => {
  try {
    const entry = await storage.getItem<ConfirmedEntry>(`${KEY_PREFIX}${bookingId}`);
    if (!entry) return undefined;
    if (Date.now() - entry.confirmedAt > GRACE_PERIOD_MS) return undefined;
    return entry.status;
  } catch {
    return undefined;
  }
};

export const forgetConfirmedBookingStatus = async (bookingId: string): Promise<void> => {
  try {
    await storage.removeItem(`${KEY_PREFIX}${bookingId}`);
  } catch {
    // Non-fatal — entry will simply expire on its own via GRACE_PERIOD_MS.
  }
};
