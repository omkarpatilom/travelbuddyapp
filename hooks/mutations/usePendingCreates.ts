import { useCallback } from 'react';
import { useMutationState, useQueryClient } from '@tanstack/react-query';
import { OperationDef, runOperation } from './operations';

export interface PendingCreate<TVars> {
  mutationId: number;
  status: 'pending' | 'error';
  variables: TVars;
  error: Error | null;
  submittedAt: number;
}

/**
 * Creates of `def.op` that are still running or have failed, read from the
 * MutationCache — so they survive navigation and show up on whichever list
 * screen the user is on. Successful creates drop out once the server's
 * entity (with its real id) is in the list (the op awaits that refetch).
 */
export function usePendingCreates<TVars, TData>(def: OperationDef<TVars, TData, any>) {
  const qc = useQueryClient();
  const items = useMutationState({
    filters: { mutationKey: [def.op], predicate: (m) => m.state.status === 'pending' || m.state.status === 'error' },
    select: (m) => ({
      mutationId: m.mutationId,
      status: m.state.status as 'pending' | 'error',
      variables: m.state.variables as TVars,
      error: m.state.error as Error | null,
      submittedAt: m.state.submittedAt,
    }),
  }) as PendingCreate<TVars>[];

  const find = (mutationId: number) =>
    qc.getMutationCache().getAll().find((m) => m.mutationId === mutationId);

  const dismiss = useCallback((mutationId: number) => {
    const m = find(mutationId);
    if (m) qc.getMutationCache().remove(m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc]);

  /** Re-submits a failed create (checking first whether it already landed). */
  const retry = useCallback((item: PendingCreate<TVars>) => {
    dismiss(item.mutationId);
    const vars = def.prepareRetry ? def.prepareRetry(item.variables) : item.variables;
    runOperation(qc, def, vars, { isHandledByCaller: () => true }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc, dismiss]);

  return { items, dismiss, retry };
}
