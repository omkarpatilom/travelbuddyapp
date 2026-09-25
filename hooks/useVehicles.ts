import { CACHE_KEYS } from '../cache/cacheKeys';
import { removeFromList, rollbackList, ListSnapshot } from '../cache/entityCache';
import { api } from '../utils/api';
import { OperationDef } from './mutations/operations';
import type { QueryClient } from '@tanstack/react-query';

/**
 * Each screen keeps its own view of "my vehicles" (the vehicle manager loads
 * features/photos/preferences, the offer form only photos, VehicleContext the
 * raw DTOs), but all of them live under the one `vehicles` root, so any
 * vehicle change refreshes every view instead of only the screen it was made on.
 */
export const vehicleKeys = {
  all: [CACHE_KEYS.vehicles] as const,
  detailed: [CACHE_KEYS.vehicles, 'my', 'detailed'] as const,
  summary: [CACHE_KEYS.vehicles, 'my', 'summary'] as const,
  raw: [CACHE_KEYS.vehicles, 'my', 'raw'] as const,
};

export const invalidateVehicles = (qc: QueryClient) => qc.invalidateQueries({ queryKey: vehicleKeys.all });

const eachVehicleList = (qc: QueryClient) =>
  qc.getQueryCache().findAll({ queryKey: vehicleKeys.all }).map((q) => q.queryKey);

/** Optimistic: the vehicle disappears from every list; restored on failure. */
export const deleteVehicleOp: OperationDef<{ vehicleId: string }, unknown, ListSnapshot[]> = {
  op: 'deleteVehicle',
  key: (v) => v.vehicleId,
  scope: (v) => `vehicle:${v.vehicleId}`,
  errorTitle: 'Could not delete vehicle',
  mutationFn: (v) => api.delete(`/vehicles/${v.vehicleId}`),
  onMutate: async (v, qc) => {
    await qc.cancelQueries({ queryKey: vehicleKeys.all });
    return eachVehicleList(qc).map((key) => removeFromList(qc, key, v.vehicleId));
  },
  onError: (_e, _v, snaps, qc) => snaps?.forEach((s) => rollbackList(qc, s)),
  onSettled: (_v, qc) => invalidateVehicles(qc),
};

/** Optimistic: the Default badge moves at once; restored on failure. */
export const setDefaultVehicleOp: OperationDef<{ vehicleId: string }, unknown, { key: readonly unknown[]; before: any[] }[]> = {
  op: 'setDefaultVehicle',
  key: () => 'default',
  errorTitle: 'Could not set default vehicle',
  mutationFn: (v) => api.patch(`/vehicles/${v.vehicleId}/default`, {}),
  onMutate: async (v, qc) => {
    await qc.cancelQueries({ queryKey: vehicleKeys.all });
    return eachVehicleList(qc).flatMap((key) => {
      const before = qc.getQueryData<any[]>(key);
      if (!Array.isArray(before)) return [];
      qc.setQueryData(key, before.map((x) => ({ ...x, isDefault: x.id === v.vehicleId })));
      return [{ key, before }];
    });
  },
  onError: (_e, _v, snaps, qc) => snaps?.forEach((s) => qc.setQueryData(s.key, s.before)),
  onSettled: (_v, qc) => invalidateVehicles(qc),
};
