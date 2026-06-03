import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Linking,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useRides } from '@/contexts/RideContext';
import { useAuth } from '@/contexts/AuthContext';
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
  X,
  CheckCircle
} from 'lucide-react-native';
import RatingModal from '@/components/RatingModal';

export default function BookingDetailsScreen() {
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [booking, setBooking] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrLoadError, setQrLoadError] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  
  const { theme } = useTheme();
  const { user } = useAuth();
  const { getBookingById, cancelBooking, confirmBooking } = useRides();
  const router = useRouter();
  const params = useLocalSearchParams();
  const bookingId = params.id as string;

  const fetchBookingDetails = useCallback(async () => {
    if (!bookingId) {
      setError('No booking ID provided');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await getBookingById(bookingId);
      if (result) {
        setBooking(result);
      } else {
        setError('Booking not found');
      }
    } catch (e: any) {
      console.error('Failed to fetch booking details:', e);
      setError(e.message || 'Failed to load booking details. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  }, [bookingId, getBookingById]);

  useEffect(() => {
    fetchBookingDetails();
  }, [fetchBookingDetails]);

  const handleCancelBooking = () => {
    if (!booking) return;

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

  const isDriver = user?.id === booking?.ride?.driverId;

  const handleConfirmBooking = async () => {
    if (!booking) return;

    Alert.alert(
      isDriver ? 'Confirm Booking Request' : 'Simulate Driver Approval',
      isDriver 
        ? `Are you sure you want to accept and confirm the booking request from ${booking.passengerName}?`
        : `Simulate confirming this booking. The booking status will be updated to Confirmed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setIsLoading(true);
            try {
              const success = await confirmBooking(booking.id);
              if (success) {
                Alert.alert('Success', 'Booking has been successfully confirmed!', [
                  { text: 'OK', onPress: () => fetchBookingDetails() }
                ]);
              } else {
                Alert.alert('Error', 'Failed to confirm booking.');
              }
            } catch (e: any) {
              console.error('Failed to confirm booking:', e);
              Alert.alert('Error', e.message || 'Failed to confirm booking.');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleCallDriver = () => {
    if (!booking?.ride) return;

    Alert.alert(
      'Call Driver',
      `Would you like to call ${booking.ride.driverName || 'Driver'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Call', 
          onPress: () => {
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
    if (!booking?.ride?.from?.coordinates) return;
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

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} testID="loading-indicator" />
        <Text style={[styles.loadingText, { color: theme.colors.textSecondary, marginTop: 12 }]}>
          Loading booking details...
        </Text>
      </View>
    );
  }

  if (error || !booking) {
    return (
      <View style={[styles.container, styles.centerContainer, { backgroundColor: theme.colors.background, padding: 20 }]}>
        <Text style={[styles.errorText, { color: theme.colors.text }]}>
          {error || 'Booking not found'}
        </Text>
        <TouchableOpacity 
          style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
          onPress={fetchBookingDetails}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
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
                Booking #{booking.id.slice(-6).toUpperCase()}
              </Text>
            </View>
            
            <Text style={[styles.bookingDate, { color: theme.colors.textSecondary }]}>
              Booked on {booking.bookingDate ? new Date(booking.bookingDate).toLocaleDateString() : 'N/A'}
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
                    {booking.ride?.from?.address || 'Pickup address not specified'}
                  </Text>
                </View>
                {booking.ride?.from?.coordinates && (
                  <TouchableOpacity 
                    style={[styles.directionsButton, { backgroundColor: theme.colors.primary }]}
                    onPress={handleGetDirections}
                  >
                    <Navigation size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
              </View>
              
              <View style={[styles.routeLine, { backgroundColor: theme.colors.border }]} />
              
              <View style={styles.locationRow}>
                <View style={[styles.locationDot, { backgroundColor: theme.colors.error }]} />
                <View style={styles.locationInfo}>
                  <Text style={[styles.locationLabel, { color: theme.colors.textSecondary }]}>Destination</Text>
                  <Text style={[styles.locationText, { color: theme.colors.text }]}>
                    {booking.ride?.to?.address || 'Destination address not specified'}
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
                    {booking.ride?.date || 'N/A'}
                  </Text>
                </View>
              </View>

              <View style={styles.tripDetailItem}>
                <Clock size={20} color={theme.colors.primary} />
                <View>
                  <Text style={[styles.tripDetailLabel, { color: theme.colors.textSecondary }]}>Time</Text>
                  <Text style={[styles.tripDetailValue, { color: theme.colors.text }]}>
                    {booking.ride?.time || 'N/A'}
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
                    {booking.ride?.carModel || 'Vehicle'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Driver Information */}
          <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Driver</Text>
            
            <View style={styles.driverCard}>
              {booking.ride?.driverAvatar ? (
                <Image source={{ uri: booking.ride.driverAvatar }} style={styles.driverAvatar} />
              ) : (
                <View style={[styles.driverAvatar, { backgroundColor: theme.colors.border, justifyContent: 'center', alignItems: 'center' }]}>
                  <Star size={30} color={theme.colors.textSecondary} />
                </View>
              )}
              <View style={styles.driverInfo}>
                <Text style={[styles.driverName, { color: theme.colors.text }]}>
                  {booking.ride?.driverName || 'Driver'}
                </Text>
                <View style={styles.ratingContainer}>
                  <Star size={16} color={theme.colors.warning} fill={theme.colors.warning} />
                  <Text style={[styles.rating, { color: theme.colors.textSecondary }]}>
                    {booking.ride?.driverRating || 5.0}
                  </Text>
                </View>
              </View>
              {(booking.status === 'confirmed' || booking.status === 'completed') && (
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
              )}
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
                  ₹{booking.ride?.price || 0.0}
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
                  ₹{booking.totalPrice}
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

          {/* Boarding Pass Refactor (Section 6) */}
          {(booking.status === 'confirmed' || booking.status === 'pending') && (
            <View style={[styles.boardingPassCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.primary }]}>
              {/* Card Notch Elements */}
              <View style={[styles.passNotchLeft, { backgroundColor: theme.colors.background }]} />
              <View style={[styles.passNotchRight, { backgroundColor: theme.colors.background }]} />
              
              <View style={styles.passHeader}>
                <Users size={16} color={theme.colors.primary} />
                <Text style={[styles.passHeaderTitle, { color: theme.colors.primary }]}>TRAVELBUDDY BOARDING PASS</Text>
              </View>

              <View style={styles.passBody}>
                 {/* Visual QR Code Mockup & Real Online Code */}
                <TouchableOpacity 
                  activeOpacity={0.8}
                  onPress={() => setIsQrModalOpen(true)}
                  style={[styles.qrContainer, { borderColor: theme.colors.border, backgroundColor: '#FFFFFF' }]}
                >
                  {/* concentric corners */}
                  <View style={styles.qrCornerTopLeft} />
                  <View style={styles.qrCornerTopRight} />
                  <View style={styles.qrCornerBottomLeft} />
                  <View style={styles.qrCornerBottomRight} />
                  
                  {!qrLoadError ? (
                    <Image
                      source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${booking.id}` }}
                      style={styles.realQrImage}
                      resizeMode="contain"
                      onError={() => setQrLoadError(true)}
                    />
                  ) : (
                    /* Concentric patterns mockup fallback (Offline) */
                    <View style={styles.qrCenterPattern}>
                      <View style={styles.qrPatternRow}>
                        <View style={[styles.qrPixel, { backgroundColor: '#09090B' }]} />
                        <View style={styles.qrPixel} />
                        <View style={[styles.qrPixel, { backgroundColor: '#09090B' }]} />
                        <View style={[styles.qrPixel, { backgroundColor: '#09090B' }]} />
                      </View>
                      <View style={styles.qrPatternRow}>
                        <View style={styles.qrPixel} />
                        <View style={[styles.qrPixel, { backgroundColor: '#09090B' }]} />
                        <View style={styles.qrPixel} />
                        <View style={styles.qrPixel} />
                      </View>
                      <View style={styles.qrPatternRow}>
                        <View style={[styles.qrPixel, { backgroundColor: '#09090B' }]} />
                        <View style={styles.qrPixel} />
                        <View style={[styles.qrPixel, { backgroundColor: '#09090B' }]} />
                        <View style={[styles.qrPixel, { backgroundColor: '#09090B' }]} />
                      </View>
                    </View>
                  )}
                </TouchableOpacity>

                {/* OTP Passcode */}
                <View style={styles.otpPassBlock}>
                  <Text style={[styles.otpPassLabel, { color: theme.colors.textSecondary }]}>BOARDING OTP PASSCODE</Text>
                  <Text style={[styles.otpPassValue, { color: theme.colors.text }]}>
                    {(() => {
                      const getBookingOtp = (id: string) => {
                        let hash = 0;
                        for (let i = 0; i < id.length; i++) {
                          hash = id.charCodeAt(i) + ((hash << 5) - hash);
                        }
                        const code = Math.abs(hash % 9000) + 1000;
                        return code.toString();
                      };
                      return getBookingOtp(booking.id).split('').join(' ');
                    })()}
                  </Text>
                </View>
              </View>

              <View style={[styles.dividerDashed, { borderBottomColor: theme.colors.border }]} />

              <View style={styles.passFooter}>
                <Text style={[styles.passInstructionsText, { color: theme.colors.textSecondary }]}>
                  💡 Present this Boarding Pass screen to your driver at pickup. The driver will verify by scanning the QR code, entering the 4-digit OTP, or using offline ID manual verification.
                </Text>
              </View>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            {booking.status === 'pending' && (
              <View style={styles.pendingActionsContainer}>
                <TouchableOpacity 
                  style={[styles.confirmButton, { backgroundColor: theme.colors.success }]}
                  onPress={handleConfirmBooking}
                >
                  <CheckCircle size={20} color="#FFFFFF" />
                  <Text style={styles.confirmButtonText}>
                    {isDriver ? 'Accept & Confirm Booking' : 'Confirm Booking (Demo)'}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.cancelButton, { backgroundColor: theme.colors.error }]}
                  onPress={handleCancelBooking}
                >
                  <X size={20} color="#FFFFFF" />
                  <Text style={styles.cancelButtonText}>Cancel Booking</Text>
                </TouchableOpacity>
              </View>
            )}

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
      </ScrollView>

      {booking.ride?.id && (
        <RatingModal
          visible={showRatingModal}
          onClose={() => setShowRatingModal(false)}
          rideId={booking.ride.id}
          driverName={booking.ride.driverName || 'Driver'}
        />
      )}

      <Modal
        visible={isQrModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsQrModalOpen(false)}
      >
        <View style={styles.fullScreenModalBg}>
          <TouchableOpacity 
            style={styles.fullScreenModalCloseBtn}
            onPress={() => setIsQrModalOpen(false)}
          >
            <X size={28} color="#FFFFFF" />
          </TouchableOpacity>
          
          <View style={styles.fullScreenQrCard}>
            <Text style={styles.fullScreenQrTitle}>SCAN TO BOARD</Text>
            
            <View style={styles.fullScreenQrWrapper}>
              {!qrLoadError ? (
                <Image
                  source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${booking.id}` }}
                  style={styles.fullScreenQrImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.fullScreenQrFallback}>
                  <Text style={{ color: theme.colors.textSecondary }}>Concentric pattern offline mockup</Text>
                </View>
              )}
            </View>
            
            <Text style={styles.fullScreenQrSubtitle}>Booking ID: {booking.id.slice(-6).toUpperCase()}</Text>
          </View>
        </View>
      </Modal>
    </View>
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
  centerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  errorText: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Boarding Pass Card Styles (Section 6)
  boardingPassCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 2,
    borderStyle: 'dashed',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 8,
  },
  passNotchLeft: {
    position: 'absolute',
    left: -12,
    top: '62%',
    width: 24,
    height: 24,
    borderRadius: 12,
    zIndex: 3,
  },
  passNotchRight: {
    position: 'absolute',
    right: -12,
    top: '62%',
    width: 24,
    height: 24,
    borderRadius: 12,
    zIndex: 3,
  },
  passHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 16,
  },
  passHeaderTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  passBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
    marginBottom: 16,
  },
  qrContainer: {
    width: 86,
    height: 86,
    borderRadius: 10,
    borderWidth: 1,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  qrCornerTopLeft: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 14,
    height: 14,
    borderWidth: 3,
    borderColor: '#09090B',
  },
  qrCornerTopRight: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 14,
    height: 14,
    borderWidth: 3,
    borderColor: '#09090B',
  },
  qrCornerBottomLeft: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    width: 14,
    height: 14,
    borderWidth: 3,
    borderColor: '#09090B',
  },
  qrCornerBottomRight: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 14,
    height: 14,
    borderWidth: 3,
    borderColor: '#09090B',
  },
  qrCenterPattern: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  qrPatternRow: {
    flexDirection: 'row',
    gap: 2,
  },
  qrPixel: {
    width: 6,
    height: 6,
    backgroundColor: 'transparent',
  },
  otpPassBlock: {
    flex: 1,
    justifyContent: 'center',
  },
  otpPassLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  otpPassValue: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 4,
  },
  dividerDashed: {
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    marginVertical: 12,
  },
  passFooter: {
    paddingHorizontal: 4,
  },
  passInstructionsText: {
    fontSize: 10.5,
    lineHeight: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  pendingActionsContainer: {
    gap: 12,
    width: '100%',
  },
  realQrImage: {
    width: '100%',
    height: '100%',
  },
  fullScreenModalBg: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenModalCloseBtn: {
    position: 'absolute',
    top: 48,
    right: 24,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  fullScreenQrCard: {
    width: 340,
    padding: 24,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  fullScreenQrTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#09090B',
    letterSpacing: 1.5,
  },
  fullScreenQrWrapper: {
    width: 260,
    height: 260,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenQrImage: {
    width: '100%',
    height: '100%',
  },
  fullScreenQrFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F4F4F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenQrSubtitle: {
    fontSize: 11,
    color: '#71717A',
    fontWeight: '500',
  },
});