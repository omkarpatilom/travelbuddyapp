import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { notificationService } from '@/services/notification.service';
import { NotificationResponseDto, NotificationPreferenceDto } from '@/utils/types';
import { CACHE_KEYS } from '@/cache/cacheKeys';
import { sqliteStorage } from '@/storage/sqlite';
import { useNotificationsQuery } from '@/hooks/useNotifications';
import { useAuth } from '@/contexts/AuthContext';

// Project ID from app.json extras.eas.projectId
const EAS_PROJECT_ID = '9c20730d-9aff-4652-bc7d-c0c376a2f451';

// Configure notification display behaviour
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationContextType {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  sendLocalNotification: (title: string, body: string) => Promise<void>;
  scheduleRideReminder: (rideId: string, rideDate: string) => Promise<void>;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  getSettings: () => Promise<NotificationPreferenceDto | null>;
  updateSettings: (settings: any) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const notificationsQuery = useNotificationsQuery();

  // Register device token with backend whenever both user + token are ready
  useEffect(() => {
    if (user && expoPushToken) {
      console.log('[Push] Registering device token:', expoPushToken.substring(0, 30) + '...');
      notificationService.registerDeviceToken(expoPushToken)
        .then(() => console.log('[Push] Device token registered successfully.'))
        .catch(err => console.error('[Push] Error registering device token:', err));
    }
  }, [user, expoPushToken]);

  // Map notifications from TanStack Query cache
  const notifications: Notification[] = (notificationsQuery.data || []).map((n: any) => ({
    id: n.id,
    title: n.title,
    message: n.body || n.message || '',
    type: n.type?.toString() || '0',
    isRead: n.status === 'Read' || n.isRead === true,
    createdAt: n.createdAt
  }));

  const isLoading = notificationsQuery.isLoading;
  const unreadCount = notifications.filter(n => !n.isRead).length;

  // Register for push and set up notification listeners
  useEffect(() => {
    // Request permissions + obtain Expo push token
    registerForPushNotificationsAsync().then(token => {
      if (token) setExpoPushToken(token);
    });

    // Listener: fires when a push notification arrives while app is foregrounded
    const notificationListener = Notifications.addNotificationReceivedListener(notif => {
      console.log('[Push] Received foreground notification:', notif.request.content.title);
      setNotification(notif);
      // Immediately invalidate so the notifications tab shows new item
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.notifications] });
    });

    // Listener: fires when user taps a notification
    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('[Push] Notification tapped:', response.notification.request.content.title);
      // Optionally navigate based on response.notification.request.content.data
    });

    // AppState: refetch when app comes back to foreground
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.notifications] });
      }
      appState.current = nextState;
    });

    return () => {
      notificationListener.remove();
      responseListener.remove();
      appStateSubscription.remove();
    };
  }, []);

  const fetchNotifications = async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.notifications] });
    } catch (e) {
      console.error('Error fetching notifications:', e);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      // Optimistic update in SQLite
      await sqliteStorage.updateNotificationReadStatus(id, true);
      await notificationService.markAsRead(id);
      await queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.notifications] });
    } catch (e) {
      console.error('Error marking notification as read:', e);
    }
  };

  const markAllAsRead = async () => {
    try {
      const cached = await sqliteStorage.getCachedNotifications();
      const unread = cached.filter(x => !x.isRead);
      for (const notif of unread) {
        await sqliteStorage.updateNotificationReadStatus(notif.id, true);
      }
      await notificationService.markAllAsRead();
      await queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.notifications] });
    } catch (e) {
      console.error('Error marking all notifications as read:', e);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await notificationService.deleteNotification(id);
      await queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.notifications] });
    } catch (e) {
      console.error('Error deleting notification:', e);
    }
  };

  const getSettings = async () => {
    try {
      return await notificationService.getPreferences();
    } catch (e) {
      console.error('Error getting notification settings:', e);
      return null;
    }
  };

  const updateSettings = async (settings: any) => {
    try {
      await notificationService.updatePreferences(settings);
    } catch (e) {
      console.error('Error updating notification settings:', e);
    }
  };

  const registerForPushNotificationsAsync = async (): Promise<string | null> => {
    // Set up Android notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('travelbuddy-default', {
        name: 'TravelBuddy Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563EB',
        sound: 'default',
        showBadge: true,
      });
    }

    // Check / request permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[Push] Notification permission not granted.');
      return null;
    }

    // Obtain Expo push token
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: EAS_PROJECT_ID,
      });
      const token = tokenData.data;
      console.log('[Push] Expo push token obtained:', token.substring(0, 40) + '...');
      return token;
    } catch (error: any) {
      console.warn('[Push] Could not get Expo push token:', error?.message);
      return null;
    }
  };

  const sendLocalNotification = async (title: string, body: string) => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        data: { timestamp: Date.now() },
      },
      trigger: null,
    });
  };

  const scheduleRideReminder = async (rideId: string, rideDate: string) => {
    const reminderDate = new Date(rideDate);
    reminderDate.setHours(reminderDate.getHours() - 1);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🚗 Ride Reminder',
        body: 'Your ride starts in 1 hour. Get ready!',
        sound: 'default',
        data: { rideId },
      },
      trigger: { date: reminderDate } as any,
    });
  };

  return (
    <NotificationContext.Provider 
      value={{ 
        expoPushToken, 
        notification, 
        notifications,
        unreadCount,
        isLoading,
        sendLocalNotification, 
        scheduleRideReminder,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        getSettings,
        updateSettings
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
