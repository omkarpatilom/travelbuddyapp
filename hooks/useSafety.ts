import { useQuery } from '@tanstack/react-query';
import { CACHE_KEYS } from '../cache/cacheKeys';
import { removeFromList, rollbackList, ListSnapshot } from '../cache/entityCache';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { OperationDef } from './mutations/operations';

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
  /** Set on a row the server hasn't created yet. */
  _pending?: { op: string; label: string };
}

/**
 * Emergency contacts: the Safety screen's list and SafetyContext share the
 * `emergencyContacts` root, so a change from either refreshes both.
 */
export const emergencyContactKeys = {
  all: [CACHE_KEYS.emergencyContacts] as const,
  list: [CACHE_KEYS.emergencyContacts, 'list'] as const,
  raw: [CACHE_KEYS.emergencyContacts, 'raw'] as const,
};

export const fetchEmergencyContacts = async (): Promise<EmergencyContact[]> => {
  const data = await api.get<any[]>('/safety/emergency-contacts');
  return (data || []).map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phoneNumber,
    relationship: c.relation || 'Contact',
  }));
};

export function useEmergencyContactsQuery() {
  const { user } = useAuth();
  return useQuery({
    queryKey: emergencyContactKeys.list,
    queryFn: fetchEmergencyContacts,
    enabled: !!user,
  });
}

export interface AddContactVars {
  name: string;
  phone: string;
  relationship: string;
  isPrimary: boolean;
  tempId: string;
}

/** Pending: a "Saving…" row until the server creates the contact. */
export const addEmergencyContactOp: OperationDef<AddContactVars> = {
  op: 'addEmergencyContact',
  key: (v) => v.phone,
  errorTitle: 'Contact was not added',
  backgroundSuccess: 'Emergency contact added.',
  mutationFn: (v) =>
    api.post('/safety/emergency-contacts', {
      name: v.name,
      phoneNumber: v.phone,
      relation: v.relationship,
      isPrimary: v.isPrimary,
    }),
  onMutate: async (v, qc) => {
    await qc.cancelQueries({ queryKey: emergencyContactKeys.list });
    const placeholder: EmergencyContact = {
      id: v.tempId,
      name: v.name,
      phone: v.phone,
      relationship: v.relationship || 'Contact',
      _pending: { op: 'addEmergencyContact', label: 'Saving…' },
    };
    qc.setQueryData<EmergencyContact[]>(emergencyContactKeys.list, (prev) => [...(prev ?? []), placeholder]);
  },
  onSettled: async (v, qc) => {
    await qc.invalidateQueries({ queryKey: emergencyContactKeys.all });
    removeFromList(qc, emergencyContactKeys.list, v.tempId);
  },
};

/** Optimistic: the contact disappears immediately; restored on failure. */
export const removeEmergencyContactOp: OperationDef<{ id: string }, unknown, ListSnapshot> = {
  op: 'removeEmergencyContact',
  key: (v) => v.id,
  errorTitle: 'Could not remove contact',
  mutationFn: (v) => api.delete(`/safety/emergency-contacts/${v.id}`),
  onMutate: async (v, qc) => {
    await qc.cancelQueries({ queryKey: emergencyContactKeys.list });
    return removeFromList(qc, emergencyContactKeys.list, v.id);
  },
  onError: (_e, _v, snap, qc) => {
    if (snap) rollbackList(qc, snap);
  },
  onSettled: (_v, qc) => qc.invalidateQueries({ queryKey: emergencyContactKeys.all }),
};
