/**
 * operations.ts
 *
 * The standard way the app runs a server mutation:
 *
 *   user action → onMutate (immediate optimistic / pending UI) → API call
 *     → success: reconcile with the server response + invalidate
 *     → failure: roll back + report (with Retry)
 *
 * Mutations are built directly on the QueryClient's MutationCache rather than
 * through a component's useMutation observer, so:
 *   - they keep running and their cache callbacks still fire after the screen
 *     that started them unmounts (navigation never loses an operation);
 *   - every screen can see an operation's state by key (useOperationPending),
 *     e.g. the booking row shows "Accepting…" on any screen that lists it;
 *   - `scope` serialises mutations on the same entity: Accept → Cancel →
 *     Accept on one booking hit the server in the order issued, so an older
 *     response can never land after a newer one.
 *
 * A synchronous in-flight guard drops a duplicate of an operation that is
 * already running (double taps in the same frame, re-submitting after
 * navigating back), which the async mutation state cannot catch in time.
 */
import { useCallback, useEffect, useRef } from 'react';
import { QueryClient, useIsMutating, useMutationState, useQueryClient } from '@tanstack/react-query';

export interface OperationDef<TVars, TData = unknown, TCtx = unknown> {
  /** Operation name, first element of the mutation key, e.g. 'confirmBooking'. */
  op: string;
  /** Entity the operation targets (id) or, for creates, a payload fingerprint. */
  key: (vars: TVars) => string;
  /** Serialises operations touching the same entity, e.g. `booking:<id>`. */
  scope?: (vars: TVars) => string;
  mutationFn: (vars: TVars) => Promise<TData>;
  onMutate?: (vars: TVars, qc: QueryClient) => TCtx | Promise<TCtx>;
  onSuccess?: (data: TData, vars: TVars, ctx: TCtx, qc: QueryClient) => void | Promise<void>;
  onError?: (error: Error, vars: TVars, ctx: TCtx | undefined, qc: QueryClient) => void | Promise<void>;
  /** Reconciliation, typically invalidation. Awaited before the op is marked settled. */
  onSettled?: (vars: TVars, qc: QueryClient, data: TData | undefined, error: Error | null) => unknown;
  /** Title shown in the global banner when nobody on screen handled a failure. */
  errorTitle: string;
  /** Shown in the banner when the op succeeds after its screen was left. */
  backgroundSuccess?: string | ((data: TData, vars: TVars) => string);
  /** Offer Retry in the banner. Default true. */
  retryable?: boolean;
  /** Adjusts variables for a user-initiated retry (e.g. to check for a create that already landed). */
  prepareRetry?: (vars: TVars) => TVars;
  /** How long a finished mutation stays in the cache (for pending/failed cards). */
  gcTime?: number;
}

// ─── Duplicate guard ─────────────────────────────────────────────────────────

const inFlight = new Map<string, Promise<unknown>>();
const guardKey = (op: string, key: string) => `${op}:${key}`;

export const isOperationInFlight = (op: string, key: string) => inFlight.has(guardKey(op, key));

/** Test helper. */
export function __resetOperations() {
  inFlight.clear();
}

// ─── Feedback bus (rendered by components/OperationFeedback.tsx) ─────────────

export interface FeedbackEvent {
  id: number;
  kind: 'error' | 'success';
  title: string;
  message: string;
  retry?: () => void;
}

type Listener = (e: FeedbackEvent) => void;
const listeners = new Set<Listener>();
let feedbackSeq = 0;

export function subscribeFeedback(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitFeedback(e: Omit<FeedbackEvent, 'id'>) {
  const event = { ...e, id: ++feedbackSeq };
  listeners.forEach((l) => l(event));
}

// ─── Runner ──────────────────────────────────────────────────────────────────

export class DuplicateOperationError extends Error {
  constructor(op: string) {
    super(`${op} is already in progress`);
    this.name = 'DuplicateOperationError';
  }
}

export interface RunOptions {
  /**
   * Set when a mounted screen will show the outcome itself. Returns whether
   * the caller is still mounted; if not, the banner reports instead.
   */
  isHandledByCaller?: () => boolean;
  /**
   * When the same operation is already running, share its result instead of
   * rejecting with DuplicateOperationError. Still sends only one request.
   */
  joinDuplicate?: boolean;
}

/**
 * Runs an operation. Rejects with DuplicateOperationError if the same
 * operation on the same key is already running (no request is sent).
 */
export function runOperation<TVars, TData, TCtx>(
  qc: QueryClient,
  def: OperationDef<TVars, TData, TCtx>,
  vars: TVars,
  options: RunOptions = {},
): Promise<TData> {
  const key = def.key(vars);
  const gk = guardKey(def.op, key);
  const existing = inFlight.get(gk);
  if (existing) {
    return options.joinDuplicate
      ? (existing as Promise<TData>)
      : Promise.reject(new DuplicateOperationError(def.op));
  }

  const mutation = qc.getMutationCache().build(qc, {
    mutationKey: [def.op, key],
    scope: def.scope ? { id: def.scope(vars) } : undefined,
    networkMode: 'always',
    retry: false,
    gcTime: def.gcTime,
    mutationFn: (v: TVars) => def.mutationFn(v),
    onMutate: (v: TVars) => (def.onMutate ? def.onMutate(v, qc) : (undefined as TCtx)),
    onSuccess: async (data: TData, v: TVars, ctx: TCtx) => {
      await def.onSuccess?.(data, v, ctx, qc);
    },
    onError: async (error: Error, v: TVars, ctx: TCtx | undefined) => {
      await def.onError?.(error, v, ctx, qc);
    },
    onSettled: async (data: TData | undefined, error: Error | null, v: TVars) => {
      try {
        await def.onSettled?.(v, qc, data, error);
      } catch (e) {
        console.warn(`[operations] ${def.op} reconcile failed`, e);
      }
    },
  });

  const promise = mutation.execute(vars);
  inFlight.set(gk, promise);
  // Keep the shared promise from surfacing as an unhandled rejection.
  promise.catch(() => {});

  return promise.then(
    (data) => {
      if (inFlight.get(gk) === promise) inFlight.delete(gk);
      const handled = options.isHandledByCaller?.() ?? false;
      if (!handled && def.backgroundSuccess) {
        const message = typeof def.backgroundSuccess === 'function' ? def.backgroundSuccess(data, vars) : def.backgroundSuccess;
        emitFeedback({ kind: 'success', title: 'Done', message });
      }
      return data;
    },
    (error: Error) => {
      if (inFlight.get(gk) === promise) inFlight.delete(gk);
      const handled = options.isHandledByCaller?.() ?? false;
      if (!handled) {
        emitFeedback({
          kind: 'error',
          title: def.errorTitle,
          message: error?.message || 'Something went wrong.',
          retry: def.retryable === false ? undefined : () => {
            runOperation(qc, def, def.prepareRetry ? def.prepareRetry(vars) : vars).catch(() => {});
          },
        });
      }
      throw error;
    },
  );
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Binds an operation to a screen. `run` resolves to `{ data }` on success and
 * to `null` when the same operation is already running (the duplicate sends
 * no request). It rejects with the API error; while the screen is mounted it
 * shows that error itself, and once it has unmounted the global banner
 * reports it instead (pass `handleErrors: false` to always use the banner).
 */
export function useOperation<TVars, TData, TCtx>(def: OperationDef<TVars, TData, TCtx>) {
  const qc = useQueryClient();
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(
    async (vars: TVars, opts: { handleErrors?: boolean } = {}): Promise<{ data: TData } | null> => {
      try {
        const data = await runOperation(qc, def, vars, {
          isHandledByCaller: () => mounted.current && opts.handleErrors !== false,
        });
        return { data };
      } catch (e) {
        if (e instanceof DuplicateOperationError) return null;
        throw e;
      }
    },
    // def objects are module constants
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [qc],
  );

  return { run, isMounted: () => mounted.current };
}

/**
 * True while `op` is running for `key` (any screen, survives navigation).
 * A missing key (entity not loaded yet) is never pending.
 */
export function useOperationPending(op: string, key?: string | null): boolean {
  const count = useIsMutating({
    mutationKey: key ? [op, key] : [op],
    predicate: (m) => m.state.status === 'pending',
  });
  return !!key && count > 0;
}

/** True while any `op` is running, whatever its key. */
export function useAnyOperationPending(op: string): boolean {
  return useIsMutating({ mutationKey: [op], predicate: (m) => m.state.status === 'pending' }) > 0;
}

/** Keys (entity ids) for which `op` is currently running. */
export function usePendingKeys(op: string): Set<string> {
  const keys = useMutationState({
    filters: { mutationKey: [op], status: 'pending' },
    select: (m) => (m.options.mutationKey?.[1] as string) ?? '',
  });
  return new Set(keys);
}
