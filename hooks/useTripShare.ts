import { useQuery } from '@tanstack/react-query';
import { qk } from '../cache/cacheKeys';
import { shareService, ShareLinkCreated, ShareNameDisplay, ActiveShareLink } from '../services/share.service';
import { OperationDef } from './mutations/operations';

/** The booking's active public tracking link (metadata only). */
export function useActiveShareLinkQuery(bookingId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: qk.tripShare(bookingId ?? ''),
    queryFn: () => shareService.getActiveLink(bookingId!),
    enabled: !!bookingId && enabled,
    staleTime: 30_000,
  });
}

export interface CreateShareLinkVars {
  rideId: string;
  bookingId: string;
  nameDisplay: ShareNameDisplay;
  nickname?: string;
}

/** Pending: the card shows "Creating link…"; the new link replaces any previous one. */
export const createShareLinkOp: OperationDef<CreateShareLinkVars, ShareLinkCreated> = {
  op: 'createShareLink',
  key: (v) => v.bookingId,
  scope: (v) => `tripShare:${v.bookingId}`,
  errorTitle: 'Could not create a tracking link',
  mutationFn: (v) => shareService.createLink(v.rideId, v.bookingId, v.nameDisplay, v.nickname),
  onSuccess: (created, v, _ctx, qc) => {
    const active: ActiveShareLink = {
      linkId: created.linkId,
      rideId: v.rideId,
      bookingId: v.bookingId,
      expiresAt: created.expiresAt,
      nameDisplay: created.nameDisplay,
      displayName: created.displayName,
    };
    qc.setQueryData(qk.tripShare(v.bookingId), active);
  },
};

/** Optimistic: sharing shows as off immediately; restored if the server refuses. */
export const disableShareLinkOp: OperationDef<{ linkId: string; bookingId: string }, unknown, ActiveShareLink | null | undefined> = {
  op: 'disableShareLink',
  key: (v) => v.linkId,
  scope: (v) => `tripShare:${v.bookingId}`,
  errorTitle: 'Could not turn off sharing',
  mutationFn: (v) => shareService.disableLink(v.linkId, v.bookingId),
  onMutate: async (v, qc) => {
    await qc.cancelQueries({ queryKey: qk.tripShare(v.bookingId) });
    const previous = qc.getQueryData<ActiveShareLink | null>(qk.tripShare(v.bookingId));
    qc.setQueryData(qk.tripShare(v.bookingId), null);
    return previous;
  },
  onError: (_e, v, previous, qc) => {
    if (previous !== undefined) qc.setQueryData(qk.tripShare(v.bookingId), previous);
  },
  onSettled: (v, qc) => qc.invalidateQueries({ queryKey: qk.tripShare(v.bookingId) }),
};
