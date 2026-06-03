import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Dimensions,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRides, Ride } from '@/contexts/RideContext';
import { MapPin, Calendar, Clock, Star, Phone, MessageCircle, Users, Car, ArrowLeft, Play, CheckCircle, XCircle, ShieldCheck, Cigarette, Heart, Wind, Music, Navigation } from 'lucide-react-native';
import RouteMap from '@/components/RouteMap';
import * as Location from 'expo-location';
import { requestLocationPermission, checkLocationPermission } from '@/utils/permissions';
import { bookingService } from '@/services/booking.service';



const { width } = Dimensions.get('window');

export default function RideDetailsScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { getRideById, startRide, arriveAtPickup, startBoarding, transitionEnRoute, completeDropoff, completeRide, cancelRide, updateTracking, getTracking, confirmBooking, cancelBooking, bookings: passengerBookings } = useRides();
  const router = useRouter();
  const params = useLocalSearchParams();
  const rideId = params.id as string;

  const [ride, setRide] = useState<Ride | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [isBookingsLoading, setIsBookingsLoading] = useState(false);

  const isDriver = user?.id === ride?.driverId;
  const passengerConfirmedBooking = ride && passengerBookings?.find(
    (b: any) => b.rideId === ride.id && (b.status === 'confirmed' || b.status === 'completed')
  );

  // Live tracking watcher/polling synchronization hook
  useEffect(() => {
    let locationSubscription: any = null;
    let pollingIntervalId: any = null;

    const startLiveTracking = async () => {
      if (!ride || ride.status !== 'started') {
        setDriverLocation(null);
        return;
      }

      if (isDriver) {
        try {
          const hasPermission = await checkLocationPermission();
          if (!hasPermission) {
            const result = await requestLocationPermission();
            if (!result.granted) {
              Alert.alert('Permission Denied', 'Location permission is required to share ride coordinates.');
              return;
            }
          }

          locationSubscription = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              timeInterval: 10000,
              distanceInterval: 10,
            },
            (location) => {
              const { latitude, longitude } = location.coords;
              updateTracking(ride.id, latitude, longitude);
              setDriverLocation({ latitude, longitude });
            }
          );
        } catch (error) {
          console.error('Error starting watchPositionAsync:', error);
        }
      } else {
        // Poll driver location from backend
        const fetchDriverLocation = async () => {
          try {
            const tracking = await getTracking(ride.id);
            if (tracking && tracking.latitude && tracking.longitude) {
              setDriverLocation({
                latitude: tracking.latitude,
                longitude: tracking.longitude,
              });
            }
          } catch (error) {
            console.warn('Error polling tracking details:', error);
          }
        };

        fetchDriverLocation();
        pollingIntervalId = setInterval(fetchDriverLocation, 10000);
      }
    };

    startLiveTracking();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
      if (pollingIntervalId) {
        clearInterval(pollingIntervalId);
      }
    };
  }, [ride?.status, isDriver, ride?.id]);

  useEffect(() => {
    if (rideId) {
      fetchRideDetails();
    }
  }, [rideId]);

  const fetchRideBookings = async (id: string) => {
    setIsBookingsLoading(true);
    try {
      const bookingsList = await bookingService.getRideBookings(id);
      const normalizedBookings = (bookingsList || []).map((b: any) => ({
        ...b,
        id: b.bookingId || b.id,
        status: (b.status || '').toLowerCase()
      }));
      setBookings(normalizedBookings);
    } catch (e) {
      console.error('Error fetching ride bookings:', e);
    } finally {
      setIsBookingsLoading(false);
    }
  };

  const fetchRideDetails = async () => {
    setIsLoading(true);
    try {
      const data = await getRideById(rideId);
      setRide(data);
      if (data && user?.id === data.driverId) {
        await fetchRideBookings(rideId);
      }
    } catch (error) {
      console.error('Error fetching ride details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptBooking = async (bookingId: string, passengerName: string) => {
    Alert.alert(
      'Confirm Booking Request',
      `Are you sure you want to accept and confirm the booking request from ${passengerName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setIsActionLoading(true);
            try {
              const success = await confirmBooking(bookingId);
              if (success) {
                Alert.alert('Success', 'Booking has been successfully confirmed!');
                await fetchRideBookings(rideId);
              } else {
                Alert.alert('Error', 'Failed to confirm booking.');
              }
            } catch (e: any) {
              console.error('Failed to confirm booking:', e);
              Alert.alert('Error', e.message || 'Failed to confirm booking.');
            } finally {
              setIsActionLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleDeclineBooking = async (bookingId: string, passengerName: string) => {
    Alert.alert(
      'Decline Booking Request',
      `Are you sure you want to decline / cancel the booking request from ${passengerName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline / Cancel',
          style: 'destructive',
          onPress: async () => {
            setIsActionLoading(true);
            try {
              const success = await cancelBooking(bookingId, 'Declined by driver');
              if (success) {
                Alert.alert('Success', 'Booking has been successfully declined / cancelled.');
                await fetchRideBookings(rideId);
              } else {
                Alert.alert('Error', 'Failed to decline booking.');
              }
            } catch (e: any) {
              console.error('Failed to decline booking:', e);
              Alert.alert('Error', e.message || 'Failed to decline booking.');
            } finally {
              setIsActionLoading(false);
            }
          }
        }
      ]
    );
  };


  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!ride) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.errorText, { color: theme.colors.text }]}>Ride not found</Text>
      </View>
    );
  }

  // isDriver is already declared at hook-level

  const handleBookRide = () => {
    router.push(`/ride/book?id=${ride.id}`);
  };

  const handleStartRide = async () => {
    setIsActionLoading(true);
    let lat: number | undefined;
    let lng: number | undefined;
    try {
      const hasPermission = await checkLocationPermission();
      if (hasPermission) {
        const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = location.coords.latitude;
        lng = location.coords.longitude;
      }
    } catch (e) {
      console.warn('Could not fetch driver coordinates for proximity check:', e);
    }
    const success = await startRide(ride.id);
    setIsActionLoading(false);
    if (success) {
      Alert.alert('Success', 'Ride started successfully!');
      fetchRideDetails();
    } else {
      Alert.alert('Error', 'Failed to start ride');
    }
  };

  const handleArriveAtPickup = async () => {
    setIsActionLoading(true);
    let lat: number | undefined;
    let lng: number | undefined;
    try {
      const hasPermission = await checkLocationPermission();
      if (hasPermission) {
        const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = location.coords.latitude;
        lng = location.coords.longitude;
      }
    } catch (e) {
      console.warn('Could not fetch driver coordinates for proximity check:', e);
    }
    const success = await arriveAtPickup(ride.id, lat, lng);
    setIsActionLoading(false);
    if (success) {
      Alert.alert('Arrived at Pickup', 'Marked arrived at pickup location! Passengers have been notified.');
      fetchRideDetails();
    } else {
      Alert.alert('Error', 'Failed to mark arrival at pickup.');
    }
  };

  const handleStartBoarding = async () => {
    setIsActionLoading(true);
    const success = await startBoarding(ride.id);
    setIsActionLoading(false);
    if (success) {
      Alert.alert('Boarding Started', 'Boarding is in progress! Passengers have been notified.');
      fetchRideDetails();
    } else {
      Alert.alert('Error', 'Failed to start passenger boarding.');
    }
  };

  const handleTransitionEnRoute = async () => {
    setIsActionLoading(true);
    const success = await transitionEnRoute(ride.id);
    setIsActionLoading(false);
    if (success) {
      Alert.alert('En Route', 'The ride is now en route to the destination! Safety monitoring is active.');
      fetchRideDetails();
    } else {
      Alert.alert('Error', 'Failed to transition ride to en route.');
    }
  };

  const handleCompleteDropoff = async () => {
    setIsActionLoading(true);
    const success = await completeDropoff(ride.id);
    setIsActionLoading(false);
    if (success) {
      Alert.alert('Drops Completed', 'Marked drop-offs complete! Passengers have been notified.');
      fetchRideDetails();
    } else {
      Alert.alert('Error', 'Failed to mark drop-offs complete.');
    }
  };

  const handleCompleteRide = async () => {
    setIsActionLoading(true);
    const success = await completeRide(ride.id);
    setIsActionLoading(false);
    if (success) {
      Alert.alert('Success', 'Ride completed successfully!');
      fetchRideDetails();
    } else {
      Alert.alert('Error', 'Failed to complete ride');
    }
  };

  const handleCancelRide = () => {
    Alert.alert('Cancel Ride', 'Are you sure you want to cancel this ride?', [
      { text: 'No', style: 'cancel' },
      { 
        text: 'Yes, Cancel', 
        style: 'destructive',
        onPress: async () => {
          setIsActionLoading(true);
          const success = await cancelRide(ride.id, 'Cancelled by driver');
          setIsActionLoading(false);
          if (success) {
            Alert.alert('Success', 'Ride cancelled');
            router.back();
          } else {
            Alert.alert('Error', 'Failed to cancel ride');
          }
        }
      }
    ]);
  };

  const handleCallDriver = () => {
    Alert.alert('Call Driver', `Would you like to call ${ride.driverName}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Call', onPress: () => Alert.alert('Calling...', 'Feature coming soon!') }
    ]);
  };

  const handleChatDriver = () => {
    Alert.alert('Chat', 'Chat feature coming soon!');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'published':
      case 'confirmed':
        return theme.colors.success;
      case 'started':
      case 'enroute':
        return theme.colors.secondary;
      case 'driverarrived':
      case 'boarding':
        return theme.colors.primary;
      case 'dropcompleted':
      case 'completed':
        return theme.colors.textSecondary;
      case 'cancelled':
        return theme.colors.error;
      case 'pending':
        return theme.colors.warning;
      default:
        return theme.colors.textSecondary;
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>Ride Details</Text>
        <View style={styles.placeholder} />
      </View>

      {/* RouteMap Section */}
      <View style={styles.mapContainer}>
        <RouteMap
          from={ride.from}
          to={ride.to}
          distance={ride.distance}
          duration={ride.duration}
          driverLocation={driverLocation}
        />
      </View>

      <View style={styles.content}>
        {/* Route Information */}
        <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Route</Text>
          
          <View style={styles.routeContainer}>
            <View style={styles.locationRow}>
              <View style={[styles.locationDot, { backgroundColor: theme.colors.secondary }]} />
              <View style={styles.locationInfo}>
                <Text style={[styles.locationLabel, { color: theme.colors.textSecondary }]}>From</Text>
                <Text style={[styles.locationText, { color: theme.colors.text }]}>{ride.from.address}</Text>
              </View>
            </View>
            
            <View style={[styles.routeLine, { backgroundColor: theme.colors.border }]} />
            
            <View style={styles.locationRow}>
              <View style={[styles.locationDot, { backgroundColor: theme.colors.error }]} />
              <View style={styles.locationInfo}>
                <Text style={[styles.locationLabel, { color: theme.colors.textSecondary }]}>To</Text>
                <Text style={[styles.locationText, { color: theme.colors.text }]}>{ride.to.address}</Text>
              </View>
            </View>
          </View>

          <View style={styles.tripInfo}>
            <View style={styles.tripItem}>
              <Text style={[styles.tripLabel, { color: theme.colors.textSecondary }]}>Distance</Text>
              <Text style={[styles.tripValue, { color: theme.colors.text }]}>{ride.distance}</Text>
            </View>
            <View style={styles.tripItem}>
              <Text style={[styles.tripLabel, { color: theme.colors.textSecondary }]}>Duration</Text>
              <Text style={[styles.tripValue, { color: theme.colors.text }]}>{ride.duration}</Text>
            </View>
          </View>
        </View>

        {/* Ride Information */}
        <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Ride Information</Text>
          
          <View style={styles.rideInfoGrid}>
            <View style={styles.infoItem}>
              <Calendar size={20} color={theme.colors.primary} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>Date</Text>
                <Text style={[styles.infoValue, { color: theme.colors.text }]}>{ride.date}</Text>
              </View>
            </View>

            <View style={styles.infoItem}>
              <Clock size={20} color={theme.colors.primary} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>Time</Text>
                <Text style={[styles.infoValue, { color: theme.colors.text }]}>{ride.time}</Text>
              </View>
            </View>

            <View style={styles.infoItem}>
              <Users size={20} color={theme.colors.primary} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>Available Seats</Text>
                <Text style={[styles.infoValue, { color: theme.colors.text }]}>{ride.availableSeats}/{ride.totalSeats}</Text>
              </View>
            </View>

            <View style={styles.infoItem}>
              <Car size={20} color={theme.colors.primary} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>Vehicle</Text>
                <Text style={[styles.infoValue, { color: theme.colors.text }]}>{ride.carModel}</Text>
              </View>
            </View>
          </View>

          <View style={styles.priceSection}>
            <Text style={[styles.priceLabel, { color: theme.colors.textSecondary }]}>Price per seat</Text>
            <Text style={[styles.price, { color: theme.colors.primary }]}>₹{ride.price}</Text>
          </View>
        </View>

        {/* Vehicle Details Card */}
        <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Vehicle Details</Text>
            <View style={[styles.verifiedBadge, { backgroundColor: theme.colors.primary + '15' }]}>
              <ShieldCheck size={16} color={theme.colors.primary} style={{ marginRight: 4 }} />
              <Text style={[styles.verifiedText, { color: theme.colors.primary }]}>Verified Vehicle</Text>
            </View>
          </View>
          
          <View style={styles.vehicleDetailContainer}>
            <View style={styles.vehicleInfoRow}>
              <View style={styles.vehicleDetailItem}>
                <Text style={[styles.vehicleDetailLabel, { color: theme.colors.textSecondary }]}>Brand & Model</Text>
                <Text style={[styles.vehicleDetailValue, { color: theme.colors.text }]}>{ride.carModel || 'Unknown'}</Text>
              </View>
              <View style={styles.vehicleDetailItem}>
                <Text style={[styles.vehicleDetailLabel, { color: theme.colors.textSecondary }]}>Color</Text>
                <Text style={[styles.vehicleDetailValue, { color: theme.colors.text }]}>{ride.carColor || 'Unknown'}</Text>
              </View>
            </View>

            <View style={[styles.vehiclePlateCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Text style={[styles.plateLabel, { color: theme.colors.textSecondary }]}>LICENSE PLATE</Text>
              <Text style={[styles.plateValue, { color: theme.colors.text }]}>
                {ride.carPlate ? ride.carPlate.toUpperCase() : 'NOT VERIFIED'}
              </Text>
            </View>
          </View>
        </View>

        {/* Driver Preferences Card */}
        <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Driver Preferences</Text>
          
          <View style={styles.preferencesGridContainer}>
            <View style={[styles.preferenceTag, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }, ride.preferences.nonSmoking && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '10' }]}>
              <Cigarette size={18} color={ride.preferences.nonSmoking ? theme.colors.primary : theme.colors.textSecondary} />
              <Text style={[styles.preferenceTagText, { color: ride.preferences.nonSmoking ? theme.colors.primary : theme.colors.text }]}>
                {ride.preferences.nonSmoking ? 'Non-Smoking' : 'Smoking Allowed'}
              </Text>
            </View>

            <View style={[styles.preferenceTag, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }, ride.preferences.musicAllowed && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '10' }]}>
              <Music size={18} color={ride.preferences.musicAllowed ? theme.colors.primary : theme.colors.textSecondary} />
              <Text style={[styles.preferenceTagText, { color: ride.preferences.musicAllowed ? theme.colors.primary : theme.colors.text }]}>
                {ride.preferences.musicAllowed ? 'Music Allowed' : 'No Music'}
              </Text>
            </View>

            <View style={[styles.preferenceTag, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }, ride.preferences.petsAllowed && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '10' }]}>
              <Heart size={18} color={ride.preferences.petsAllowed ? theme.colors.primary : theme.colors.textSecondary} />
              <Text style={[styles.preferenceTagText, { color: ride.preferences.petsAllowed ? theme.colors.primary : theme.colors.text }]}>
                {ride.preferences.petsAllowed ? 'Pets Allowed' : 'No Pets'}
              </Text>
            </View>

            <View style={[styles.preferenceTag, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }, ride.preferences.airConditioning && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '10' }]}>
              <Wind size={18} color={ride.preferences.airConditioning ? theme.colors.primary : theme.colors.textSecondary} />
              <Text style={[styles.preferenceTagText, { color: ride.preferences.airConditioning ? theme.colors.primary : theme.colors.text }]}>
                {ride.preferences.airConditioning ? 'A/C Available' : 'No A/C'}
              </Text>
            </View>
          </View>

          <View style={[styles.conversationCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={styles.conversationEmoji}>
              {ride.preferences.conversationLevel === 'quiet' ? '🤫' : ride.preferences.conversationLevel === 'moderate' ? '😊' : '😄'}
            </Text>
            <View style={styles.conversationInfo}>
              <Text style={[styles.conversationLabel, { color: theme.colors.textSecondary }]}>Conversation Level</Text>
              <Text style={[styles.conversationValue, { color: theme.colors.text }]}>
                {ride.preferences.conversationLevel.charAt(0).toUpperCase() + ride.preferences.conversationLevel.slice(1)}
              </Text>
            </View>
          </View>
        </View>

        {/* Driver Card */}
        {!isDriver && (
          <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Driver</Text>
            
            <View style={styles.driverCard}>
              <Image source={{ uri: ride.driverAvatar }} style={styles.driverAvatar} />
              <View style={styles.driverInfo}>
                <Text style={[styles.driverName, { color: theme.colors.text }]}>{ride.driverName}</Text>
                <View style={styles.ratingContainer}>
                  <Star size={16} color={theme.colors.warning} fill={theme.colors.warning} />
                  <Text style={[styles.rating, { color: theme.colors.textSecondary }]}>{ride.driverRating}</Text>
                  <Text style={[styles.ratingCount, { color: theme.colors.textSecondary }]}>(25 reviews)</Text>
                </View>
                <Text style={[styles.phoneNumber, { color: theme.colors.textSecondary }]}>+1 (555) ***-**90</Text>
              </View>
              {passengerConfirmedBooking && (
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
        )}

        {/* Passenger Bookings Section */}
        {isDriver && (
          <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Passenger Bookings</Text>
            
            {isBookingsLoading ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : bookings.length === 0 ? (
              <Text style={[styles.emptyBookingsText, { color: theme.colors.textSecondary }]}>
                No bookings for this ride yet.
              </Text>
            ) : (
              <View style={styles.bookingsListContainer}>
                {bookings.map((item) => {
                  const initials = item.passengerName
                    ? item.passengerName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
                    : 'P';
                  return (
                    <View key={item.id} style={[styles.bookingItemCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
                      {/* Booking Item Header */}
                      <View style={styles.bookingItemHeader}>
                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                          </Text>
                        </View>
                        <Text style={[styles.bookingIdText, { color: theme.colors.textSecondary }]}>
                          Booking #{item.id.slice(-6).toUpperCase()}
                        </Text>
                      </View>

                      {/* Passenger Details Info */}
                      <View style={styles.passengerDetailRow}>
                        <View style={[styles.avatarCircle, { backgroundColor: theme.colors.primary + '15' }]}>
                          <Text style={[styles.avatarText, { color: theme.colors.primary }]}>{initials}</Text>
                        </View>
                        
                        <View style={styles.passengerInfoBlock}>
                          <Text style={[styles.passengerName, { color: theme.colors.text }]}>
                            {item.passengerName}
                          </Text>
                          <Text style={[styles.passengerSeats, { color: theme.colors.textSecondary }]}>
                            {item.seats} Seat{item.seats > 1 ? 's' : ''} requested
                          </Text>
                          <Text style={[styles.bookingPayoutText, { color: theme.colors.textSecondary }]}>
                            Payout: <Text style={{ fontWeight: 'bold', color: theme.colors.success }}>₹{item.totalPrice}</Text>
                          </Text>
                        </View>

                        {/* Quick Contact shortcuts */}
                        {(item.status === 'confirmed' || item.status === 'completed') && (
                          <View style={styles.quickContactContainer}>
                            <TouchableOpacity 
                              style={[styles.contactIconBtn, { borderColor: theme.colors.border }]}
                              onPress={() => Linking.openURL(`tel:${item.passengerPhone}`).catch(() => Alert.alert('Error', 'Cannot dial number.'))}
                            >
                              <Phone size={14} color={theme.colors.text} />
                            </TouchableOpacity>
                            <TouchableOpacity 
                              style={[styles.contactIconBtn, { borderColor: theme.colors.border }]}
                              onPress={() => Linking.openURL(`sms:${item.passengerPhone}`).catch(() => Alert.alert('Error', 'Cannot send SMS.'))}
                            >
                              <MessageCircle size={14} color={theme.colors.text} />
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>

                      {/* Requested Locations */}
                      <View style={[styles.bookingLocationsSection, { borderTopColor: theme.colors.border }]}>
                        <View style={styles.bookingLocationRow}>
                          <MapPin size={14} color={theme.colors.secondary} style={{ marginRight: 6 }} />
                          <Text style={[styles.bookingLocationText, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                            From: <Text style={{ color: theme.colors.text, fontWeight: '500' }}>{ride.from.address}</Text>
                          </Text>
                        </View>
                        <View style={[styles.bookingLocationRow, { marginTop: 4 }]}>
                          <MapPin size={14} color={theme.colors.error} style={{ marginRight: 6 }} />
                          <Text style={[styles.bookingLocationText, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                            To: <Text style={{ color: theme.colors.text, fontWeight: '500' }}>{ride.to.address}</Text>
                          </Text>
                        </View>
                      </View>

                      {/* Actions for each booking */}
                      {item.status === 'pending' && (
                        <View style={styles.bookingCardActions}>
                          <TouchableOpacity 
                            style={[styles.actionBtnSuccess, { backgroundColor: theme.colors.success }]}
                            onPress={() => handleAcceptBooking(item.id, item.passengerName)}
                          >
                            <CheckCircle size={16} color="#FFFFFF" />
                            <Text style={styles.actionBtnText}>Accept Request</Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={[styles.actionBtnDanger, { backgroundColor: theme.colors.error }]}
                            onPress={() => handleDeclineBooking(item.id, item.passengerName)}
                          >
                            <XCircle size={16} color="#FFFFFF" />
                            <Text style={styles.actionBtnText}>Decline</Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {item.status === 'confirmed' && (
                        <View style={styles.bookingCardActions}>
                          <TouchableOpacity 
                            style={[styles.actionBtnOutline, { borderColor: theme.colors.error }]}
                            onPress={() => handleDeclineBooking(item.id, item.passengerName)}
                          >
                            <XCircle size={16} color={theme.colors.error} />
                            <Text style={[styles.actionBtnOutlineText, { color: theme.colors.error }]}>Cancel Booking</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {isDriver ? (
            <View style={{ gap: 12 }}>
              {['started', 'enroute', 'driverarrived', 'boarding', 'dropcompleted'].includes(ride.status) ? (
                <TouchableOpacity 
                  style={[styles.bookButton, { backgroundColor: theme.colors.primary, flexDirection: 'row' }]}
                  onPress={() => router.push(`/ride/command-center?id=${ride.id}`)}
                >
                  <Navigation size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.bookButtonText}>Resume Ride in Command Center</Text>
                </TouchableOpacity>
              ) : ['active', 'scheduled', 'published', 'confirmed', 'seatsbooked'].includes(ride.status) ? (
                <View style={{ gap: 12 }}>
                  <TouchableOpacity 
                    style={[styles.bookButton, { backgroundColor: theme.colors.primary, flexDirection: 'row' }]}
                    onPress={() => router.push(`/ride/command-center?id=${ride.id}`)}
                  >
                    <Play size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.bookButtonText}>Open Journey Command Center</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.bookButton, { backgroundColor: theme.colors.error, flexDirection: 'row' }]}
                    onPress={handleCancelRide}
                    disabled={isActionLoading}
                  >
                    <XCircle size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.bookButtonText}>Cancel Ride</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={[styles.passengerBanner, { backgroundColor: theme.colors.textSecondary + '15', borderColor: theme.colors.textSecondary }]}>
                  <CheckCircle size={24} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.bannerTitle, { color: theme.colors.textSecondary }]}>
                      Ride {ride.status.charAt(0).toUpperCase() + ride.status.slice(1)}
                    </Text>
                    <Text style={[styles.bannerText, { color: theme.colors.text }]}>
                      This offered ride is {ride.status}.
                    </Text>
                  </View>
                </View>
              )}
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {['active', 'published', 'scheduled'].includes(ride.status) && (
                <TouchableOpacity 
                  style={[styles.bookButton, { backgroundColor: theme.colors.primary }]}
                  onPress={handleBookRide}
                >
                  <Text style={styles.bookButtonText}>Book This Ride</Text>
                </TouchableOpacity>
              )}

              {['confirmed', 'seatsbooked'].includes(ride.status) && (
                <View style={[styles.passengerBanner, { backgroundColor: theme.colors.success + '15', borderColor: theme.colors.success }]}>
                  <ShieldCheck size={24} color={theme.colors.success} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.bannerTitle, { color: theme.colors.success }]}>Ride Confirmed</Text>
                    <Text style={[styles.bannerText, { color: theme.colors.text }]}>Your driver {ride.driverName} will begin the journey shortly.</Text>
                  </View>
                </View>
              )}

              {ride.status === 'driverarrived' && (
                <View style={[styles.passengerBanner, { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary }]}>
                  <MapPin size={24} color={theme.colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.bannerTitle, { color: theme.colors.primary }]}>Driver Has Arrived!</Text>
                    <Text style={[styles.bannerText, { color: theme.colors.text }]}>{ride.driverName} has arrived at the pickup location. Please head to the vehicle.</Text>
                  </View>
                </View>
              )}

              {ride.status === 'boarding' && (
                <View style={[styles.passengerBanner, { backgroundColor: theme.colors.primary + '10', borderColor: theme.colors.primary }]}>
                  <Users size={24} color={theme.colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.bannerTitle, { color: theme.colors.primary }]}>Boarding Active</Text>
                    <Text style={[styles.bannerText, { color: theme.colors.text }]}>Passenger boarding is currently active. Please proceed with check-in.</Text>
                  </View>
                </View>
              )}

              {['started', 'enroute'].includes(ride.status) && (
                <View style={{ gap: 12 }}>
                  <View style={[styles.passengerBanner, { backgroundColor: theme.colors.secondary + '15', borderColor: theme.colors.secondary }]}>
                    <Car size={24} color={theme.colors.secondary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.bannerTitle, { color: theme.colors.secondary }]}>Trip En Route</Text>
                      <Text style={[styles.bannerText, { color: theme.colors.text }]}>You are on your way! Real-time location tracking and safety monitoring are active.</Text>
                    </View>
                  </View>
                  
                  {/* Floating emergency SOS trigger card */}
                  <View style={[styles.sosCard, { backgroundColor: theme.colors.error + '10', borderColor: theme.colors.error }]}>
                    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                      <ShieldCheck size={22} color={theme.colors.error} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.sosCardTitle, { color: theme.colors.error }]}>Safety SOS System Active</Text>
                        <Text style={[styles.sosCardText, { color: theme.colors.text }]}>Need assistance? Trigger local SOS or alert your primary emergency contacts.</Text>
                      </View>
                    </View>
                    <TouchableOpacity 
                      style={[styles.sosButton, { backgroundColor: theme.colors.error }]}
                      onPress={() => Alert.alert('SOS Triggered', 'Emergency services and your emergency contacts have been notified. Stay calm.')}
                    >
                      <Text style={styles.sosButtonText}>Emergency SOS Trigger</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {ride.status === 'dropcompleted' && (
                <View style={[styles.passengerBanner, { backgroundColor: theme.colors.success + '15', borderColor: theme.colors.success }]}>
                  <CheckCircle size={24} color={theme.colors.success} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.bannerTitle, { color: theme.colors.success }]}>Arrived at Destination</Text>
                    <Text style={[styles.bannerText, { color: theme.colors.text }]}>Your drop-off is complete. Remember to check for all your personal items!</Text>
                  </View>
                </View>
              )}

              {ride.status === 'completed' && (
                <View style={[styles.passengerBanner, { backgroundColor: theme.colors.textSecondary + '15', borderColor: theme.colors.textSecondary }]}>
                  <CheckCircle size={24} color={theme.colors.textSecondary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.bannerTitle, { color: theme.colors.textSecondary }]}>Ride Completed</Text>
                    <Text style={[styles.bannerText, { color: theme.colors.text }]}>Thank you for riding with TravelBuddy! Rate your experience below.</Text>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
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
  mapContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  mapPlaceholder: {
    alignItems: 'center',
    gap: 8,
  },
  mapText: {
    fontSize: 16,
    fontWeight: '600',
  },
  mapSubtext: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  content: {
    padding: 20,
    gap: 20,
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
  routeLine: {
    width: 2,
    height: 30,
    marginLeft: 5,
  },
  tripInfo: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  tripItem: {
    alignItems: 'center',
  },
  tripLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  tripValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  rideInfoGrid: {
    gap: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  priceSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  priceLabel: {
    fontSize: 16,
  },
  price: {
    fontSize: 24,
    fontWeight: 'bold',
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
    backgroundColor: '#E1E1E1',
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
    marginBottom: 4,
  },
  rating: {
    fontSize: 14,
    fontWeight: '600',
  },
  ratingCount: {
    fontSize: 14,
  },
  phoneNumber: {
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
  actionButtons: {
    gap: 12,
    marginTop: 20,
    marginBottom: 40,
  },
  bookButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 100,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '600',
  },
  vehicleDetailContainer: {
    gap: 16,
  },
  vehicleInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  vehicleDetailItem: {
    flex: 1,
  },
  vehicleDetailLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  vehicleDetailValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  vehiclePlateCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  plateLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  plateValue: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 2,
  },
  preferencesGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  preferenceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
    minWidth: '47%',
    flexGrow: 1,
  },
  preferenceTagText: {
    fontSize: 14,
    fontWeight: '500',
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 12,
    marginTop: 6,
  },
  conversationEmoji: {
    fontSize: 24,
  },
  conversationInfo: {
    flex: 1,
  },
  conversationLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  conversationValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  controlCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  controlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  controlStatusText: {
    fontSize: 14,
    marginBottom: 4,
  },
  stepsIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    paddingHorizontal: 20,
  },
  stepDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 1,
  },
  stepBar: {
    flex: 1,
    height: 3,
    marginHorizontal: -2,
  },
  stepsLabelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  stepLabel: {
    fontSize: 10,
    fontWeight: '600',
    width: 60,
    textAlign: 'center',
  },
  passengerBanner: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  bannerText: {
    fontSize: 14,
    lineHeight: 18,
  },
  sosCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sosCardTitle: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  sosCardText: {
    fontSize: 13,
    lineHeight: 16,
    opacity: 0.8,
  },
  sosButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  emptyBookingsText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  bookingsListContainer: {
    gap: 12,
  },
  bookingItemCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  bookingItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bookingIdText: {
    fontSize: 12,
  },
  passengerDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  passengerInfoBlock: {
    flex: 1,
    gap: 2,
  },
  passengerName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  passengerSeats: {
    fontSize: 13,
  },
  bookingPayoutText: {
    fontSize: 13,
  },
  quickContactContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  contactIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookingCardActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  actionBtnSuccess: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  actionBtnDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  actionBtnOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  actionBtnOutlineText: {
    fontSize: 14,
    fontWeight: '600',
  },
  bookingLocationsSection: {
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 2,
    gap: 6,
  },
  bookingLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bookingLocationText: {
    fontSize: 12,
    flex: 1,
  },
});