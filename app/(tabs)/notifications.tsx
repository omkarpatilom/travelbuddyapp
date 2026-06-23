import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { useRides } from '@/contexts/RideContext';
import {
  Bell,
  Car,
  Calendar,
  Star,
  CircleCheck as CheckCircle,
  X,
} from 'lucide-react-native';

export default function NotificationsScreen() {
  const { theme } = useTheme();
  const {
    notifications,
    unreadCount,
    isLoading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  const [refreshing, setRefreshing] = useState(false);
  const [isLoadingAction, setIsLoadingAction] = useState(false);
  const { bookings, completeBooking } = useRides();

  const handleConfirmDropoff = async (bookingId: string) => {
    Alert.alert(
      'Confirm Safe Drop-off',
      'Are you sure you want to confirm you have arrived and been safely dropped off?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Confirm',
          onPress: async () => {
            setIsLoadingAction(true);
            try {
              const ok = await completeBooking(bookingId);
              if (ok) {
                Alert.alert(
                  'Success',
                  'Drop-off confirmed successfully! Thank you for traveling with TravelBuddy.',
                );
                await fetchNotifications();
              } else {
                Alert.alert('Error', 'Failed to confirm drop-off.');
              }
            } catch (err: any) {
              Alert.alert(
                'Error',
                err.message || 'Failed to confirm drop-off.',
              );
            } finally {
              setIsLoadingAction(false);
            }
          },
        },
      ],
    );
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  };

  const getNotificationIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('booking'))
      return <Calendar size={20} color={theme.colors.primary} />;
    if (t.includes('ride'))
      return <Car size={20} color={theme.colors.secondary} />;
    if (t.includes('review'))
      return <Star size={20} color={theme.colors.warning} />;
    return <Bell size={20} color={theme.colors.accent} />;
  };

  const formatTimestamp = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const renderNotification = ({ item }: { item: any }) => {
    const titleLower = (item.title || '').toLowerCase();
    const msgLower = (item.message || '').toLowerCase();
    const isDropoffMsg =
      titleLower.includes('drop') ||
      titleLower.includes('arrive') ||
      titleLower.includes('enroute') ||
      msgLower.includes('drop') ||
      msgLower.includes('arrive') ||
      msgLower.includes('enroute');
    const matchingBooking = isDropoffMsg
      ? (bookings || []).find((b) => b.status === 'confirmed')
      : null;

    return (
      <TouchableOpacity
        style={[
          styles.notificationCard,
          {
            backgroundColor: item.isRead
              ? theme.colors.card
              : theme.colors.primary + '10',
            borderColor: theme.colors.border,
          },
        ]}
        onPress={() => !item.isRead && markAsRead(item.id)}
      >
        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <View style={styles.iconContainer}>
              <View
                style={[
                  styles.iconPlaceholder,
                  { backgroundColor: theme.colors.surface },
                ]}
              >
                {getNotificationIcon(item.type)}
              </View>
            </View>

            <View style={styles.textContent}>
              <View style={styles.titleRow}>
                <Text
                  style={[styles.title, { color: theme.colors.text }]}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                {!item.isRead && (
                  <View
                    style={[
                      styles.unreadDot,
                      { backgroundColor: theme.colors.primary },
                    ]}
                  />
                )}
              </View>

              <Text
                style={[styles.message, { color: theme.colors.textSecondary }]}
                numberOfLines={2}
              >
                {item.message}
              </Text>

              <Text
                style={[
                  styles.timestamp,
                  { color: theme.colors.textSecondary },
                ]}
              >
                {formatTimestamp(item.createdAt)}
              </Text>
            </View>
          </View>

          {matchingBooking && (
            <View
              style={[styles.actionButtons, { marginTop: 8, marginLeft: 52 }]}
            >
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  { backgroundColor: theme.colors.success },
                ]}
                onPress={() => handleConfirmDropoff(matchingBooking.id)}
              >
                <CheckCircle size={14} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>
                  Confirm Safe Drop-off
                </Text>
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
  };

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.colors.surface,
            borderBottomColor: theme.colors.border,
          },
        ]}
      >
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            Notifications
          </Text>
          {unreadCount > 0 && (
            <View
              style={[styles.badge, { backgroundColor: theme.colors.primary }]}
            >
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>

        {unreadCount > 0 && (
          <TouchableOpacity
            onPress={markAllAsRead}
            style={styles.markAllButton}
          >
            <Text style={[styles.markAllText, { color: theme.colors.primary }]}>
              Mark all as read
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderNotification}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
          />
        }
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator
              size="large"
              color={theme.colors.primary}
              style={{ marginTop: 40 }}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Bell size={60} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                No notifications
              </Text>
              <Text
                style={[
                  styles.emptyText,
                  { color: theme.colors.textSecondary },
                ]}
              >
                You're all caught up! New notifications will appear here.
              </Text>
            </View>
          )
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
  headerTitle: {
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
