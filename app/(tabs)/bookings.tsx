import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRides } from '@/contexts/RideContext';
import { Calendar, Clock, MapPin, Star, Phone, X } from 'lucide-react-native';
import { mockBookings } from '@/data/mockData';

export default function BookingsScreen() {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  
  const { theme } = useTheme();
  const { user } = useAuth();
  const { cancelBooking } = useRides();
  const router = useRouter();

  const upcomingBookings = mockBookings.filter(booking => 
    booking.status === 'confirmed' || booking.status === 'pending'
  );

  const pastBookings = mockBookings.filter(booking => 
    booking.status === 'completed' || booking.status === 'cancelled'
  );

  const handleCancelBooking = (bookingId: string) => {
    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this booking?',
      [
        { text: 'No', style: 'cancel' },
        { 
          text: 'Yes, Cancel', 
          style: 'destructive',
          onPress: async () => {
            const success = await cancelBooking(bookingId);
            if (success) {
              Alert.alert('Success', 'Your booking has been cancelled');
            } else {
              Alert.alert('Error', 'Failed to cancel booking. Please try again.');
            }
          }
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return theme.colors.success;
      case 'pending': return theme.colors.warning;
      case 'cancelled': return theme.colors.error;
      case 'completed': return theme.colors.textSecondary;
      default: return theme.colors.textSecondary;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'confirmed': return 'Confirmed';
      case 'pending': return 'Pending';
      case 'cancelled': return 'Cancelled';
      case 'completed': return 'Completed';
      default: return status;
    }
  };

  const renderBooking = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={[styles.bookingCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
      onPress={() => router.push(`/booking/details?id=${item.id}`)}
    >
      <View style={styles.bookingHeader}>
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {getStatusText(item.status)}
            </Text>
          </View>
          {item.status === 'confirmed' && (
            <TouchableOpacity 
              onPress={() => handleCancelBooking(item.id)}
              style={[styles.cancelButton, { backgroundColor: theme.colors.error + '20' }]}
            >
              <X size={16} color={theme.colors.error} />
            </TouchableOpacity>
          )}
        </View>

        <Text style={[styles.bookingId, { color: theme.colors.textSecondary }]}>
          Booking #{item.id}
        </Text>
      </View>

      <View style={styles.rideInfo}>
        <View style={styles.driverInfo}>
          <Image source={{ uri: item.ride.driverAvatar }} style={styles.driverAvatar} />
          <View style={styles.driverDetails}>
            <Text style={[styles.driverName, { color: theme.colors.text }]}>
              {item.ride.driverName}
            </Text>
            <View style={styles.ratingContainer}>
              <Star size={14} color={theme.colors.warning} fill={theme.colors.warning} />
              <Text style={[styles.rating, { color: theme.colors.textSecondary }]}>
                {item.ride.driverRating}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={[styles.phoneButton, { backgroundColor: theme.colors.primary }]}>
            <Phone size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.routeContainer}>
          <View style={styles.locationRow}>
            <MapPin size={16} color={theme.colors.secondary} />
            <Text style={[styles.locationText, { color: theme.colors.text }]} numberOfLines={1}>
              {item.ride.from.address}
            </Text>
          </View>
          <View style={styles.locationRow}>
            <MapPin size={16} color={theme.colors.error} />
            <Text style={[styles.locationText, { color: theme.colors.text }]} numberOfLines={1}>
              {item.ride.to.address}
            </Text>
          </View>
        </View>

        <View style={styles.bookingDetails}>
          <View style={styles.detailRow}>
            <Calendar size={16} color={theme.colors.textSecondary} />
            <Text style={[styles.detailText, { color: theme.colors.textSecondary }]}>
              {item.ride.date} • {item.ride.time}
            </Text>
          </View>
          <View style={styles.priceContainer}>
            <Text style={[styles.seatsText, { color: theme.colors.textSecondary }]}>
              {item.seats} seat{item.seats > 1 ? 's' : ''}
            </Text>
            <Text style={[styles.totalPrice, { color: theme.colors.primary }]}>
              ${item.totalPrice}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <Text style={[styles.title, { color: theme.colors.text }]}>My Bookings</Text>
        
        <View style={[styles.tabContainer, { backgroundColor: theme.colors.background }]}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'upcoming' && { backgroundColor: theme.colors.primary }]}
            onPress={() => setActiveTab('upcoming')}
          >
            <Text style={[
              styles.tabText, 
              { color: activeTab === 'upcoming' ? '#FFFFFF' : theme.colors.textSecondary }
            ]}>
              Upcoming
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'past' && { backgroundColor: theme.colors.primary }]}
            onPress={() => setActiveTab('past')}
          >
            <Text style={[
              styles.tabText, 
              { color: activeTab === 'past' ? '#FFFFFF' : theme.colors.textSecondary }
            ]}>
              Past
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={activeTab === 'upcoming' ? upcomingBookings : pastBookings}
        keyExtractor={(item) => item.id}
        renderItem={renderBooking}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
              No {activeTab} bookings
            </Text>
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
              {activeTab === 'upcoming' 
                ? 'Book your first ride to see it here' 
                : 'Your completed rides will appear here'
              }
            </Text>
            {activeTab === 'upcoming' && (
              <TouchableOpacity 
                style={[styles.searchButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => router.push('/ride/find')}
              >
                <Text style={styles.searchButtonText}>Find Rides</Text>
              </TouchableOpacity>
            )}
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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  tabContainer: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    padding: 20,
    gap: 16,
  },
  bookingCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 16,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cancelButton: {
    padding: 4,
    borderRadius: 6,
  },
  bookingId: {
    fontSize: 12,
  },
  rideInfo: {
    gap: 12,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  driverAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rating: {
    fontSize: 14,
  },
  phoneButton: {
    padding: 8,
    borderRadius: 8,
  },
  routeContainer: {
    gap: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationText: {
    fontSize: 14,
    flex: 1,
  },
  bookingDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 14,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  seatsText: {
    fontSize: 12,
    marginBottom: 2,
  },
  totalPrice: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  searchButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});