import { useQuery } from '@tanstack/react-query';
import { qk } from '../cache/cacheKeys';
import { removeFromList, rollbackList, ListSnapshot } from '../cache/entityCache';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { OperationDef } from './mutations/operations';

export interface SavedLocation {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  type: 'Home' | 'Work' | 'Favorite' | 'Other';
  /** Set on a row the server hasn't created yet. */
  _pending?: { op: string; label: string };
}

// The type is not stored by the API; it is derived from the name, exactly as
// Home, Find Ride and Saved Locations each did before.
export const mapSavedLocation = (item: any): SavedLocation => {
  let derivedType: SavedLocation['type'] = 'Favorite';
  const lowerName = (item.name || '').toLowerCase();
  if (lowerName === 'home') {
    derivedType = 'Home';
  } else if (lowerName === 'work') {
    derivedType = 'Work';
  } else if (lowerName === 'favorite') {
    derivedType = 'Favorite';
  } else {
    derivedType = 'Other';
  }
  return {
    id: item.id,
    name: item.name,
    address: item.address,
    latitude: item.latitude,
    longitude: item.longitude,
    type: derivedType,
  };
};

export const fetchSavedLocations = async (): Promise<SavedLocation[]> => {
  const data = await api.get<any[]>('/saved-locations');
  return (data || []).map(mapSavedLocation);
};

/** One list for Home, Find Ride, Saved Locations and the location picker. */
export function useSavedLocationsQuery() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.savedLocations(),
    queryFn: fetchSavedLocations,
    enabled: !!user,
    staleTime: 0,
  });
}

export interface AddSavedLocationVars {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  /** Local id of the "Saving…" row; never sent to the server. */
  tempId: string;
}

/**
 * Pending: a "Saving…" row appears straight away. It has no server id and
 * can't be acted on; the refetch after the POST replaces it with the real
 * location. On failure the row is removed and the error reported.
 */
export const addSavedLocationOp: OperationDef<AddSavedLocationVars> = {
  op: 'addSavedLocation',
  key: (v) => `${v.name}|${v.address}`,
  errorTitle: 'Location was not saved',
  backgroundSuccess: 'Location saved.',
  mutationFn: (v) =>
    api.post('/saved-locations', {
      name: v.name,
      address: v.address,
      latitude: v.latitude || 0,
      longitude: v.longitude || 0,
    }),
  onMutate: async (v, qc) => {
    await qc.cancelQueries({ queryKey: qk.savedLocations() });
    const placeholder: SavedLocation = {
      ...mapSavedLocation({ id: v.tempId, name: v.name, address: v.address, latitude: v.latitude, longitude: v.longitude }),
      _pending: { op: 'addSavedLocation', label: 'Saving…' },
    };
    qc.setQueryData<SavedLocation[]>(qk.savedLocations(), (prev) => [...(prev ?? []), placeholder]);
  },
  onSettled: async (v, qc) => {
    await qc.invalidateQueries({ queryKey: qk.savedLocations() });
    // Whatever happened, the placeholder never outlives the operation.
    removeFromList(qc, qk.savedLocations(), v.tempId);
  },
};

/** Optimistic: the row disappears immediately; restored on failure. */
export const deleteSavedLocationOp: OperationDef<{ id: string }, unknown, ListSnapshot> = {
  op: 'deleteSavedLocation',
  key: (v) => v.id,
  errorTitle: 'Could not delete location',
  mutationFn: (v) => api.delete(`/saved-locations/${v.id}`),
  onMutate: async (v, qc) => {
    await qc.cancelQueries({ queryKey: qk.savedLocations() });
    return removeFromList(qc, qk.savedLocations(), v.id);
  },
  onError: (_e, _v, snap, qc) => {
    if (snap) rollbackList(qc, snap);
  },
  onSettled: (_v, qc) => qc.invalidateQueries({ queryKey: qk.savedLocations() }),
};
