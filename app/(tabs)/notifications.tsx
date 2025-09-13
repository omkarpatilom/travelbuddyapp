import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Bell, Car, Calendar, Star, CircleCheck as CheckCircle, X } from 'lucide-react-native';

interface Notification {
  id: string;
  type: 'booking' | 'ride' | 'review' | 'system';
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  avatar?: string;
  actionRequired?: boolean;
}

const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'booking',
    title: 'New Booking Request',
    message: 'John Doe wants to book 2 seats for your ride to San Francisco',
    timestamp: '2 minutes ago',
    isRead: false,
    avatar: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150',
    actionRequired: true,
  },
  {
    id: '2',
    type: 'ride',
    title: 'Ride Confirmed',
    message: 'Your booking for the ride to Berkeley has been confirmed',
    timestamp: '1 hour ago',
    isRead: false,
    avatar: 'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=150',
  },
  {
    id: '3',
    type: 'review',
    title: 'New Review Received',
    message: 'Sarah Wilson left you a 5-star review: "Great driver, very punctual!"',
    timestamp: '3 hours ago',
    isRead: true,
    avatar: 'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=150',
  },
  {
    id: '4',
    type: 'system',
    title: 'Ride Reminder',
    message: 'Your ride to Santa Clara starts in 1 hour. Get ready!',
    timestamp: '5 hours ago',
    isRead: true,
  },
  {
    id: '5',
    type: 'booking',
    title: 'Booking Cancelled',
    message: 'Mike Chen cancelled his booking for tomorrow\'s ride',
    timestamp: '1 day ago',
    isRead: true,
    avatar: 'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=150',
  },
];

export default function NotificationsScreen() {
  const { theme } = useTheme();
  const [notifications, setNotifications] = useState(mockNotifications);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'booking':
        return <Calendar size={20} color={theme.colors.primary} />;
      case 'ride':
        return <Car size={20} color={theme.colors.secondary} />;
      case 'review':
        return <Star size={20} color={theme.colors.warning} />;
      case 'system':
        return <Bell size={20} color={theme.colors.accent} />;
      default:
        return <Bell size={20} color={theme.colors.textSecondary} />;
    }
  };

  const markAsRead = (notificationId: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === notificationId 
          ? { ...notification, isRead: true }
          : notification
      )
    );
  };

  const deleteNotification = (notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const renderNotification = ({ item }: { item: Notification }) => (
    <TouchableOpacity 
      style={[
        styles.notificationCard, 
        { 
          backgroundColor: item.isRead ? theme.colors.card : theme.colors.primary + '10',
          borderColor: theme.colors.border 
        }
      ]}
      onPress={() => markAsRead(item.id)}
    >
      <View style={styles.notificationContent}>
        <View style={styles.notificationHeader}>
          <View style={styles.iconContainer}>
            {item.avatar ? (
              <Image source={{ uri: item.avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.iconPlaceholder, { backgroundColor: theme.colors.surface }]}>
                {getNotificationIcon(item.type)}
              </View>
            )}
          </View>
          
          <View style={styles.textContent}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={1}>
                {item.title}
              </Text>
              {!item.isRead && (
                <View style={[styles.unreadDot, { backgroundColor: theme.colors.primary }]} />
              )}
            </View>
            
            <Text style={[styles.message, { color: theme.colors.textSecondary }]} numberOfLines={2}>
              {item.message}
            </Text>
            
            <Text style={[styles.timestamp, { color: theme.colors.textSecondary }]}>
              {item.timestamp}
            </Text>
          </View>
        </View>

        {item.actionRequired && (
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: theme.colors.secondary }]}
            >
              <CheckCircle size={16} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: theme.colors.error }]}
            >
              <X size={16} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Decline</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <TouchableOpacity 
        style={styles.deleteButton}
        onPress={() => deleteNotification(item.id)}
      >
        <X size={16} color={theme.colors.textSecondary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <View style={styles.headerContent}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={[styles.badge, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllAsRead} style={styles.markAllButton}>
            <Text style={[styles.markAllText, { color: theme.colors.primary }]}>Mark all as read</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderNotification}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Bell size={60} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No notifications</Text>
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
              You're all caught up! New notifications will appear here.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  badge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  markAllButton: {
    alignSelf: 'flex-end',
  },
  markAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    padding: 20,
    gap: 12,
  },
  notificationCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'flex-start',
    gap: 12,
  },
  notificationContent: {
    flex: 1,
    gap: 12,
  },
  notificationHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  iconContainer: {
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  iconPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContent: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
  },
  timestamp: {
    fontSize: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    padding: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
});