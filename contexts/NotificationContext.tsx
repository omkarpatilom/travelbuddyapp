import React, { createContext, useContext, useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { notificationService } from '@/services/notification.service';
import { NotificationResponseDto, NotificationPreferenceDto } from '@/utils/types';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  useEffect(() => {
    registerForPushNotificationsAsync().then(token => setExpoPushToken(token));

    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      setNotification(notification);
      fetchNotifications();
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
    });

    return () => {
      notificationListener.remove();
      responseListener.remove();
    };
  }, []);

  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      const data = await notificationService.getMyNotifications();
      setNotifications(data.map(n => ({
        id: n.id,
        title: n.title,
        message: n.body,
        type: n.type.toString(),
        isRead: n.status === 'Read',
        createdAt: n.createdAt
      })));
    } catch (e) {
      console.error('Error fetching notifications:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (e) {
      console.error('Error marking notification as read:', e);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (e) {
      console.error('Error marking all notifications as read:', e);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await notificationService.deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
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
    let token = null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563EB',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    try {
      token = (await Notifications.getExpoPushTokenAsync()).data;
    } catch (error: any) {
      if (error?.message?.includes('projectId') || error?.message?.includes('VALIDATION_ERROR')) {
        console.log('Skipping push token registration: EAS projectId missing.');
      }
    }

    return token;
  };

  const sendLocalNotification = async (title: string, body: string) => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
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
        title: 'Ride Reminder',
        body: 'Your ride is starting in 1 hour. Get ready!',
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
