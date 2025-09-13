import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useRides } from '@/contexts/RideContext';
import { 
  ArrowLeft, 
  MapPin, 
  Calendar, 
  Clock, 
  Star, 
  Phone, 
  MessageCircle, 
  Users, 
  Car,
  CreditCard,
  Navigation,
  X
} from 'lucide-react-native';
import { mockBookings } from '@/data/mockData';
import RatingModal from '@/components/RatingModal';

export default function BookingDetailsScreen() {
  const [showRatingModal, setShowRatingModal] = useState(false);
  
  const { theme } = useTheme();
  const { cancelBooking } = useRides();
  const router = useRouter();
  const params = useLocalSearchParams();
  const bookingId = params.id as string;

  // Find the booking by ID
  const booking = mockBookings.find(b => b.id === bookingId);

  if (!booking) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.errorText, { color: theme.colors.text }]}>Booking not found</Text>
      </View>
    );
  }

  const handleCancelBooking = () => {
    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this booking? This action cannot be undone.',
      [
        { text: 'No', style: 'cancel' },
        { 
          text: 'Yes, Cancel', 
          style: 'destructive',
          onPress: async () => {
            const success = await cancelBooking(booking.id);
            if (success) {
              Alert.alert('Success', 'Your booking has been cancelled', [
                { text: 'OK', onPress: () => router.back() }
              ]);
            } else {
              Alert.alert('Error', 'Failed to cancel booking. Please try again.');
            }
          }
        },
      ]
    );
  };

  const handleCallDriver = () => {
    Alert.alert(
      'Call Driver',
      `Would you like to call ${booking.ride.driverName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Call', 
          onPress: () => {
            // In a real app, this would make an actual phone call
            Linking.openURL(`tel:+1234567890`);
          }
        }
      ]
    );
  };

  const handleChatDriver = () => {
    Alert.alert('Chat', 'Chat feature coming soon!');
  };

  const handleGetDirections = () => {
    const { latitude, longitude } = booking.ride.from.coordinates;
    const url = `https://maps.google.com/?q=${latitude},${longitude}`;
    Linking.openURL(url);
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
      case 'pending': return 'Pending Confirmation';
      case 'cancelled': return 'Cancelled';
      case 'completed': return 'Completed';
      default: return status;
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>Booking Details</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        {/* Status Card */}
        <View style={[styles.statusCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.statusHeader}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) + '20' }]}>
              <Text style={[styles.statusText, { color: getStatusColor(booking.status) }]}>
                {getStatusText(booking.status)}
              </Text>
            </View>
            <Text style={[styles.bookingId, { color: theme.colors.textSecondary }]}>
              Booking #{booking.id}
            </Text>
          </View>
          
          <Text style={[styles.bookingDate, { color: theme.colors.textSecondary }]}>
            Booked on {new Date(booking.bookingDate).toLocaleDateString()}
          </Text>
        </View>

        {/* Route Information */}
        <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Trip Details</Text>
          
          <View style={styles.routeContainer}>
            <View style={styles.locationRow}>
              <View style={[styles.locationDot, { backgroundColor: theme.colors.secondary }]} />
              <View style={styles.locationInfo}>
                <Text style={[styles.locationLabel, { color: theme.colors.textSecondary }]}>Pickup</Text>
                <Text style={[styles.locationText, { color: theme.colors.text }]}>
                  {booking.ride.from.address}
                </Text>
              </View>
              <TouchableOpacity 
                style={[styles.directionsButton, { backgroundColor: theme.colors.primary }]}
                onPress={handleGetDirections}
              >
                <Navigation size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            
            <View style={[styles.routeLine, { backgroundColor: theme.colors.border }]} />
            
            <View style={styles.locationRow}>
              <View style={[styles.locationDot, { backgroundColor: theme.colors.error }]} />
              <View style={styles.locationInfo}>
                <Text style={[styles.locationLabel, { color: theme.colors.textSecondary }]}>Destination</Text>
                <Text style={[styles.locationText, { color: theme.colors.text }]}>
                  {booking.ride.to.address}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.tripDetails}>
            <View style={styles.tripDetailItem}>
              <Calendar size={20} color={theme.colors.primary} />
              <View>
                <Text style={[styles.tripDetailLabel, { color: theme.colors.textSecondary }]}>Date</Text>
                <Text style={[styles.tripDetailValue, { color: theme.colors.text }]}>
                  {booking.ride.date}
                </Text>
              </View>
            </View>

            <View style={styles.tripDetailItem}>
              <Clock size={20} color={theme.colors.primary} />
              <View>
                <Text style={[styles.tripDetailLabel, { color: theme.colors.textSecondary }]}>Time</Text>
                <Text style={[styles.tripDetailValue, { color: theme.colors.text }]}>
                  {booking.ride.time}
                </Text>
              </View>
            </View>

            <View style={styles.tripDetailItem}>
              <Users size={20} color={theme.colors.primary} />
              <View>
                <Text style={[styles.tripDetailLabel, { color: theme.colors.textSecondary }]}>Seats</Text>
                <Text style={[styles.tripDetailValue, { color: theme.colors.text }]}>
                  {booking.seats} seat{booking.seats > 1 ? 's' : ''}
                </Text>
              </View>
            </View>

            <View style={styles.tripDetailItem}>
              <Car size={20} color={theme.colors.primary} />
              <View>
                <Text style={[styles.tripDetailLabel, { color: theme.colors.textSecondary }]}>Vehicle</Text>
                <Text style={[styles.tripDetailValue, { color: theme.colors.text }]}>
                  {booking.ride.carModel}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Driver Information */}
        <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Driver</Text>
          
          <View style={styles.driverCard}>
            <Image source={{ uri: booking.ride.driverAvatar }} style={styles.driverAvatar} />
            <View style={styles.driverInfo}>
              <Text style={[styles.driverName, { color: theme.colors.text }]}>
                {booking.ride.driverName}
              </Text>
              <View style={styles.ratingContainer}>
                <Star size={16} color={theme.colors.warning} fill={theme.colors.warning} />
                <Text style={[styles.rating, { color: theme.colors.textSecondary }]}>
                  {booking.ride.driverRating}
                </Text>
                <Text style={[styles.ratingCount, { color: theme.colors.textSecondary }]}>
                  (25 reviews)
                </Text>
              </View>
            </View>
            <View style={styles.contactButtons}>
              <TouchableOpacity 
                style={[styles.contactButton, { backgroundColor: theme.colors.secondary }]}
                onPress={handleCallDriver}
              >
                <Phone size={18} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.contactButton, { backgroundColor: theme.colors.primary }]}
                onPress={handleChatDriver}
              >
                <MessageCircle size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Payment Information */}
        <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Payment Summary</Text>
          
          <View style={styles.paymentDetails}>
            <View style={styles.paymentRow}>
              <Text style={[styles.paymentLabel, { color: theme.colors.textSecondary }]}>
                Price per seat
              </Text>
              <Text style={[styles.paymentValue, { color: theme.colors.text }]}>
                ${booking.ride.price}
              </Text>
            </View>

            <View style={styles.paymentRow}>
              <Text style={[styles.paymentLabel, { color: theme.colors.textSecondary }]}>
                Number of seats
              </Text>
              <Text style={[styles.paymentValue, { color: theme.colors.text }]}>
                {booking.seats}
              </Text>
            </View>

            <View style={[styles.paymentRow, styles.totalRow]}>
              <Text style={[styles.totalLabel, { color: theme.colors.text }]}>
                Total Amount
              </Text>
              <Text style={[styles.totalValue, { color: theme.colors.primary }]}>
                ${booking.totalPrice}
              </Text>
            </View>
          </View>

          <View style={[styles.paymentMethod, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <CreditCard size={20} color={theme.colors.primary} />
            <Text style={[styles.paymentMethodText, { color: theme.colors.text }]}>
              Credit Card ending in 4242
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {booking.status === 'confirmed' && (
            <TouchableOpacity 
              style={[styles.cancelButton, { backgroundColor: theme.colors.error }]}
              onPress={handleCancelBooking}
            >
              <X size={20} color="#FFFFFF" />
              <Text style={styles.cancelButtonText}>Cancel Booking</Text>
            </TouchableOpacity>
          )}

          {booking.status === 'completed' && (
            <TouchableOpacity 
              style={[styles.rateButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => setShowRatingModal(true)}
            >
              <Star size={20} color="#FFFFFF" />
              <Text style={styles.rateButtonText}>Rate This Ride</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <RatingModal
        visible={showRatingModal}
        onClose={() => setShowRatingModal(false)}
        rideId={booking.ride.id}
        driverName={booking.ride.driverName}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 40,
  },
  content: {
    padding: 20,
    gap: 20,
  },
  statusCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  bookingId: {
    fontSize: 14,
  },
  bookingDate: {
    fontSize: 14,
  },
  section: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    gap: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  routeContainer: {
    gap: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  locationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  locationInfo: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  locationText: {
    fontSize: 16,
    fontWeight: '500',
  },
  directionsButton: {
    padding: 8,
    borderRadius: 8,
  },
  routeLine: {
    width: 2,
    height: 30,
    marginLeft: 5,
  },
  tripDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  tripDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: '45%',
  },
  tripDetailLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  tripDetailValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  driverAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rating: {
    fontSize: 14,
    fontWeight: '600',
  },
  ratingCount: {
    fontSize: 14,
  },
  contactButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  contactButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentDetails: {
    gap: 12,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentLabel: {
    fontSize: 14,
  },
  paymentValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  totalRow: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    marginTop: 8,
  },
  paymentMethodText: {
    fontSize: 16,
    fontWeight: '500',
  },
  actionButtons: {
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  rateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  rateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 100,
  },
});