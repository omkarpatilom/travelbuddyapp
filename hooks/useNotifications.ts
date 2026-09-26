import { useQuery } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { notificationService } from '../services/notification.service';
import { sqliteStorage } from '../storage/sqlite';
import { CACHE_KEYS, qk } from '../cache/cacheKeys';
import { ListSnapshot, removeFromList, rollbackList, updateInList } from '../cache/entityCache';
import { OperationDef } from './mutations/operations';

export function useNotificationsQuery(enabled: boolean = true) {
  return useQuery({
    queryKey: [CACHE_KEYS.notifications],
    queryFn: async () => {
      const netState = await NetInfo.fetch();
      
      if (!netState.isConnected) {
        // Offline fallback to SQLite cache
        const cached = await sqliteStorage.getCachedNotifications();
        return cached;
      }

      // Online: Fetch from backend and cache
      const notifications = await notificationService.getMyNotifications();
      // An empty or cut-off response body parses to {}; fail the fetch so the
      // last good list stays on screen instead of crashing .map() consumers.
      if (!Array.isArray(notifications)) {
        throw new Error('Unexpected notifications response');
      }

      try {
        await sqliteStorage.cacheNotifications(notifications);
      } catch (e) {
        console.warn('Failed to cache notifications in SQLite', e);
      }

      return notifications;
    },
    staleTime: 0,                  // Always re-fetch for freshness
    refetchInterval: enabled ? 20_000 : false,       // Poll every 20 seconds for real-time updates
    refetchIntervalInBackground: false, // Pause polling when app is in background
    enabled: enabled,
  });
}

// ─── Operations ──────────────────────────────────────────────────────────────
// Optimistic: read/delete state changes in the list (and the SQLite offline
// copy) immediately; a server failure restores both.

export const markNotificationReadOp: OperationDef<{ id: string }, unknown, ListSnapshot> = {
  op: 'markNotificationRead',
  key: (v) => v.id,
  errorTitle: 'Could not mark notification as read',
  mutationFn: (v) => notificationService.markAsRead(v.id),
  onMutate: async (v, qc) => {
    await qc.cancelQueries({ queryKey: qk.notifications() });
    try {
      await sqliteStorage.updateNotificationReadStatus(v.id, true);
    } catch (e) {
      console.warn('Failed to update sqlite notification read status', e);
    }
    return updateInList(qc, qk.notifications(), v.id, (n) => ({ ...n, isRead: true }));
  },
  onError: async (_e, v, snap, qc) => {
    if (snap) rollbackList(qc, snap);
    if (snap?.replaced && !snap.replaced.before?.isRead) {
      await sqliteStorage.updateNotificationReadStatus(v.id, false).catch(() => {});
    }
  },
  onSettled: (_v, qc) => qc.invalidateQueries({ queryKey: qk.notifications() }),
};

export const markAllNotificationsReadOp: OperationDef<void, unknown, { before?: any[]; unreadIds: string[] }> = {
  op: 'markAllNotificationsRead',
  key: () => 'all',
  errorTitle: 'Could not mark notifications as read',
  mutationFn: () => notificationService.markAllAsRead(),
  onMutate: async (_v, qc) => {
    await qc.cancelQueries({ queryKey: qk.notifications() });
    const before = qc.getQueryData<any[]>(qk.notifications());
    if (Array.isArray(before)) {
      qc.setQueryData(qk.notifications(), before.map((n) => ({ ...n, isRead: true })));
    }
    // Sync the local SQLite copy, as before.
    let unreadIds: string[] = [];
    try {
      const cached = await sqliteStorage.getCachedNotifications();
      unreadIds = cached.filter((x) => !x.isRead).map((x) => x.id);
      for (const id of unreadIds) {
        await sqliteStorage.updateNotificationReadStatus(id, true);
      }
    } catch (e) {
      console.warn('Failed to bulk update sqlite notifications', e);
    }
    return { before, unreadIds };
  },
  onError: async (_e, _v, ctx, qc) => {
    if (ctx?.before) qc.setQueryData(qk.notifications(), ctx.before);
    for (const id of ctx?.unreadIds ?? []) {
      await sqliteStorage.updateNotificationReadStatus(id, false).catch(() => {});
    }
  },
  onSettled: (_v, qc) => qc.invalidateQueries({ queryKey: qk.notifications() }),
};

export const deleteNotificationOp: OperationDef<{ id: string }, unknown, ListSnapshot> = {
  op: 'deleteNotification',
  key: (v) => v.id,
  errorTitle: 'Could not delete notification',
  mutationFn: (v) => notificationService.deleteNotification(v.id),
  onMutate: async (v, qc) => {
    await qc.cancelQueries({ queryKey: qk.notifications() });
    return removeFromList(qc, qk.notifications(), v.id);
  },
  onError: (_e, _v, snap, qc) => {
    if (snap) rollbackList(qc, snap);
  },
  onSettled: (_v, qc) => qc.invalidateQueries({ queryKey: qk.notifications() }),
};
