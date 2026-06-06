import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { notificationService } from '../services/notification.service';
import { sqliteStorage } from '../storage/sqlite';
import { CACHE_KEYS } from '../cache/cacheKeys';

export function useNotificationsQuery() {
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
      
      try {
        await sqliteStorage.cacheNotifications(notifications);
      } catch (e) {
        console.warn('Failed to cache notifications in SQLite', e);
      }

      return notifications;
    },
    staleTime: 0,                  // Always re-fetch for freshness
    refetchInterval: 20_000,       // Poll every 20 seconds for real-time updates
    refetchIntervalInBackground: false, // Pause polling when app is in background
  });
}

export function useMarkAsReadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Optimistically update SQLite cache first to support fast offline UI
      try {
        await sqliteStorage.updateNotificationReadStatus(id, true);
      } catch (e) {
        console.warn('Failed to update sqlite notification read status', e);
      }
      return await notificationService.markAsRead(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.notifications] });
    },
  });
}

export function useMarkAllAsReadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const netState = await NetInfo.fetch();
      if (netState.isConnected) {
        await notificationService.markAllAsRead();
      }

      // Sync local SQLite cache
      try {
        const cached = await sqliteStorage.getCachedNotifications();
        const unread = cached.filter(x => !x.isRead);
        for (const notif of unread) {
          await sqliteStorage.updateNotificationReadStatus(notif.id, true);
        }
      } catch (e) {
        console.warn('Failed to bulk update sqlite notifications', e);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.notifications] });
    },
  });
}
