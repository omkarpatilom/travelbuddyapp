/**
 * entityCache.ts
 *
 * One place that knows every query a ride or booking appears in, so a
 * mutation can update all of them at once (My Bookings, Booking Details,
 * Ride Details, Command Center, My Rides, search results) instead of each
 * screen holding its own copy that goes stale.
 *
 * Optimistic changes are recorded as "overlays": a patch that stays applied
 * on top of whatever the server returns until the mutation that created it
 * settles. Query functions run fresh server data through applyOverlays(), so
 * a refetch that lands mid-mutation (a poll, a focus refetch, another
 * screen's invalidation) cannot wipe out the optimistic state. Rollback
 * removes the overlay and re-derives the entity from its pre-mutation value
 * plus any overlays still active, so rolling back one mutation never undoes
 * a different, still-running one on the same entity.
 */
import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { CACHE_KEYS } from './cacheKeys';

export type EntityKind = 'ride' | 'booking';

/** Transient marker the UI reads to show "Accepting…" / "Updating…". */
export interface PendingMarker {
  op: string;
  label: string;
}

interface Overlay {
  token: number;
  patch: Record<string, any>;
}

const overlays = new Map<string, Overlay[]>();
let overlaySeq = 0;

const overlayKey = (kind: EntityKind, id: string) => `${kind}:${(id || '').toLowerCase()}`;

const sameId = (a?: string, b?: string) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();

/** Merge every active overlay for an entity onto a server value. */
export function applyOverlays<T extends Record<string, any>>(kind: EntityKind, entity: T): T {
  if (!entity) return entity;
  const id = entity.id ?? entity.bookingId;
  const active = overlays.get(overlayKey(kind, id));
  if (!active || active.length === 0) return entity;
  return active.reduce((acc, o) => ({ ...acc, ...o.patch }), entity);
}

function pushOverlay(kind: EntityKind, id: string, patch: Record<string, any>): number {
  const token = ++overlaySeq;
  const key = overlayKey(kind, id);
  overlays.set(key, [...(overlays.get(key) ?? []), { token, patch }]);
  return token;
}

function popOverlay(kind: EntityKind, id: string, token: number) {
  const key = overlayKey(kind, id);
  const remaining = (overlays.get(key) ?? []).filter((o) => o.token !== token);
  if (remaining.length) overlays.set(key, remaining);
  else overlays.delete(key);
}

/** Test helper. */
export function __resetOverlays() {
  overlays.clear();
}

// ─── Where each entity lives ─────────────────────────────────────────────────

const RIDE_ROOTS = [CACHE_KEYS.rides, CACHE_KEYS.rideDetails, CACHE_KEYS.bookings];
const BOOKING_ROOTS = [CACHE_KEYS.bookings, CACHE_KEYS.rideBookings];

type Updater = (entity: any) => any;

/**
 * Walks a cached value (a single entity or a list of them) and replaces the
 * matching entity. For rides it also reaches into bookings' embedded `ride`,
 * so My Bookings reflects a ride change too.
 */
function mapCached(kind: EntityKind, data: any, id: string, update: Updater): { next: any; before: any[] } {
  const before: any[] = [];
  const visit = (item: any): any => {
    if (!item || typeof item !== 'object') return item;
    const itemId = item.id ?? item.bookingId;
    if (kind === 'ride') {
      if (sameId(itemId, id) && item.driverId !== undefined) {
        before.push(item);
        return update(item);
      }
      if (item.ride && sameId(item.ride.id, id)) {
        before.push(item.ride);
        return { ...item, ride: update(item.ride) };
      }
      return item;
    }
    if (sameId(itemId, id) && item.rideId !== undefined) {
      before.push(item);
      return update(item);
    }
    return item;
  };
  const next = Array.isArray(data) ? data.map(visit) : visit(data);
  return { next, before };
}

export interface EntitySnapshot {
  kind: EntityKind;
  id: string;
  token: number;
  /** Pre-mutation value of the entity in each query it was found in. */
  entries: { queryKey: QueryKey; before: any }[];
}

function forEachEntityQuery(qc: QueryClient, kind: EntityKind, fn: (queryKey: QueryKey, data: any) => void) {
  const roots: readonly string[] = kind === 'ride' ? RIDE_ROOTS : BOOKING_ROOTS;
  qc.getQueryCache()
    .findAll({ predicate: (q) => roots.includes(q.queryKey[0] as string) })
    .forEach((q) => {
      if (q.state.data !== undefined) fn(q.queryKey, q.state.data);
    });
}

/**
 * Stops in-flight fetches of every query that shows this entity, so a
 * response that started before the mutation cannot land after it.
 */
export async function cancelEntityQueries(qc: QueryClient, kind: EntityKind) {
  const roots: readonly string[] = kind === 'ride' ? RIDE_ROOTS : BOOKING_ROOTS;
  await qc.cancelQueries({ predicate: (q) => roots.includes(q.queryKey[0] as string) });
}

/**
 * Applies `patch` to the entity in every cached query and keeps it applied
 * (as an overlay) across refetches until the returned snapshot is released
 * with commitEntity() or rollbackEntity().
 */
export function patchEntity(qc: QueryClient, kind: EntityKind, id: string, patch: Record<string, any>): EntitySnapshot {
  const token = pushOverlay(kind, id, patch);
  const entries: EntitySnapshot['entries'] = [];
  forEachEntityQuery(qc, kind, (queryKey, data) => {
    const { next, before } = mapCached(kind, data, id, (e) => ({ ...e, ...patch }));
    if (before.length) {
      entries.push({ queryKey, before: before[0] });
      qc.setQueryData(queryKey, next);
    }
  });
  return { kind, id, token, entries };
}

/**
 * Writes server-confirmed fields into every cached copy without an overlay
 * (the next refetch is free to replace them).
 */
export function setEntityFields(qc: QueryClient, kind: EntityKind, id: string, fields: Record<string, any>) {
  forEachEntityQuery(qc, kind, (queryKey, data) => {
    const { next, before } = mapCached(kind, data, id, (e) => ({ ...e, ...fields }));
    if (before.length) qc.setQueryData(queryKey, next);
  });
}

/** Success: drop the overlay and the pending marker, keep server fields. */
export function commitEntity(qc: QueryClient, snap: EntitySnapshot, confirmed: Record<string, any> = {}) {
  popOverlay(snap.kind, snap.id, snap.token);
  forEachEntityQuery(qc, snap.kind, (queryKey, data) => {
    const { next, before } = mapCached(snap.kind, data, snap.id, (e) => {
      const { _pending, ...rest } = e;
      return applyOverlays(snap.kind, { ...rest, ...confirmed });
    });
    if (before.length) qc.setQueryData(queryKey, next);
  });
}

/** Failure: restore the pre-mutation value (plus any other active overlays). */
export function rollbackEntity(qc: QueryClient, snap: EntitySnapshot) {
  popOverlay(snap.kind, snap.id, snap.token);
  snap.entries.forEach(({ queryKey, before }) => {
    const data = qc.getQueryData(queryKey);
    if (data === undefined) return;
    const { _pending, ...clean } = before ?? {};
    const { next } = mapCached(snap.kind, data, snap.id, () => applyOverlays(snap.kind, clean));
    qc.setQueryData(queryKey, next);
  });
}

/** Refetches every query that shows the entity. */
export function invalidateEntity(qc: QueryClient, kind: EntityKind, rideId?: string) {
  const roots: readonly string[] = kind === 'ride' ? RIDE_ROOTS : [...BOOKING_ROOTS, CACHE_KEYS.rides];
  const tasks = roots.map((root) => qc.invalidateQueries({ queryKey: [root] }));
  if (rideId) tasks.push(qc.invalidateQueries({ queryKey: [CACHE_KEYS.rideDetails, rideId] }));
  return Promise.all(tasks);
}

// ─── Simple collections (vehicles, saved locations, contacts…) ───────────────

export interface ListSnapshot {
  queryKey: QueryKey;
  removed?: { item: any; index: number };
  replaced?: { id: string; before: any };
}

const itemId = (x: any) => x?.id ?? x?.vehicleId ?? x?.contactId;

/** Removes an item from a cached list; returns what rollbackList needs. */
export function removeFromList(qc: QueryClient, queryKey: QueryKey, id: string): ListSnapshot {
  const list = qc.getQueryData<any[]>(queryKey);
  if (!Array.isArray(list)) return { queryKey };
  const index = list.findIndex((x) => sameId(itemId(x), id));
  if (index === -1) return { queryKey };
  qc.setQueryData(queryKey, list.filter((_, i) => i !== index));
  return { queryKey, removed: { item: list[index], index } };
}

/** Replaces fields on one item in a cached list. */
export function updateInList(qc: QueryClient, queryKey: QueryKey, id: string, update: (item: any) => any): ListSnapshot {
  const list = qc.getQueryData<any[]>(queryKey);
  if (!Array.isArray(list)) return { queryKey };
  const before = list.find((x) => sameId(itemId(x), id));
  if (!before) return { queryKey };
  qc.setQueryData(queryKey, list.map((x) => (sameId(itemId(x), id) ? update(x) : x)));
  return { queryKey, replaced: { id, before } };
}

export function rollbackList(qc: QueryClient, snap: ListSnapshot) {
  const list = qc.getQueryData<any[]>(snap.queryKey);
  if (!Array.isArray(list)) return;
  if (snap.removed) {
    const { item, index } = snap.removed;
    if (list.some((x) => sameId(itemId(x), itemId(item)))) return;
    const next = [...list];
    next.splice(Math.min(index, next.length), 0, item);
    qc.setQueryData(snap.queryKey, next);
  }
  if (snap.replaced) {
    const { id, before } = snap.replaced;
    qc.setQueryData(snap.queryKey, list.map((x) => (sameId(itemId(x), id) ? before : x)));
  }
}
