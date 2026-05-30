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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRides, Ride } from '@/contexts/RideContext';
import { MapPin, Calendar, Clock, Star, Phone, MessageCircle, Users, Car, ArrowLeft, Play, CheckCircle, XCircle, ShieldCheck, Cigarette, Heart, Wind, Music } from 'lucide-react-native';
import RouteMap from '@/components/RouteMap';
import * as Location from 'expo-location';
import { requestLocationPermission, checkLocationPermission } from '@/utils/permissions';


const { width } = Dimensions.get('window');

export default function RideDetailsScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { getRideById, startRide, completeRide, cancelRide, updateTracking, getTracking } = useRides();
  const router = useRouter();
  const params = useLocalSearchParams();
  const rideId = params.id as string;

  const [ride, setRide] = useState<Ride | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const isDriver = user?.id === ride?.driverId;

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

  const fetchRideDetails = async () => {
    setIsLoading(true);
    try {
      const data = await getRideById(rideId);
      setRide(data);
    } catch (error) {
      console.error('Error fetching ride details:', error);
    } finally {
      setIsLoading(false);
    }
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
    const success = await startRide(ride.id);
    setIsActionLoading(false);
    if (success) {
      Alert.alert('Success', 'Ride started successfully!');
      fetchRideDetails();
    } else {
      Alert.alert('Error', 'Failed to start ride');
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
      case 'active': return theme.colors.success;
      case 'started': return theme.colors.secondary;
      case 'completed': return theme.colors.textSecondary;
      case 'cancelled': return theme.colors.error;
      default: return theme.colors.textSecondary;
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
            <Text style={[styles.price, { color: theme.colors.primary }]}>${ride.price}</Text>
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
            {!isDriver && (
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

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {isDriver ? (
            <>
              {ride.status === 'active' && (
                <TouchableOpacity 
                  style={[styles.bookButton, { backgroundColor: theme.colors.secondary, flexDirection: 'row' }]}
                  onPress={handleStartRide}
                  disabled={isActionLoading}
                >
                  <Play size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.bookButtonText}>Start Ride</Text>
                </TouchableOpacity>
              )}
              {ride.status === 'started' && (
                <TouchableOpacity 
                  style={[styles.bookButton, { backgroundColor: theme.colors.success, flexDirection: 'row' }]}
                  onPress={handleCompleteRide}
                  disabled={isActionLoading}
                >
                  <CheckCircle size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.bookButtonText}>Complete Ride</Text>
                </TouchableOpacity>
              )}
              {(ride.status === 'active' || ride.status === 'started') && (
                <TouchableOpacity 
                  style={[styles.bookButton, { backgroundColor: theme.colors.error, marginTop: 12, flexDirection: 'row' }]}
                  onPress={handleCancelRide}
                  disabled={isActionLoading}
                >
                  <XCircle size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.bookButtonText}>Cancel Ride</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            ride.status === 'active' && (
              <TouchableOpacity 
                style={[styles.bookButton, { backgroundColor: theme.colors.primary }]}
                onPress={handleBookRide}
              >
                <Text style={styles.bookButtonText}>Book This Ride</Text>
              </TouchableOpacity>
            )
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
});