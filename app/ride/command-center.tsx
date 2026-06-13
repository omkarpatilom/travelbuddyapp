import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Platform,
  Linking,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRides, Ride, Booking } from '@/contexts/RideContext';
import RouteMap from '@/components/RouteMap';
import { bookingService } from '@/services/booking.service';
import { formatPrice } from '@/utils/validation';
import {
  MapPin,
  Clock,
  Phone,
  MessageCircle,
  Users,
  Car,
  ArrowLeft,
  Play,
  CheckCircle,
  XCircle,
  ShieldAlert,
  Navigation,
  Compass,
  History,
  TrendingUp,
  Camera,
  ChevronRight
} from 'lucide-react-native';
import * as Location from 'expo-location';
import { checkLocationPermission, requestLocationPermission } from '@/utils/permissions';
import { CameraView, useCameraPermissions } from 'expo-camera';

const { width, height } = Dimensions.get('window');

interface Stop {
  id: string;
  name: string;
  type: 'pickup' | 'drop';
  address: string;
  coordinates: { latitude: number; longitude: number };
  passengerCount: number;
  seatsCount: number;
  bookings: Booking[];
  status: 'pending' | 'current' | 'completed';
}

export default function JourneyCommandCenterScreen() {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const {
    getRideById,
    startRide,
    verifyBooking,
    completeStop,
  } = useRides();
  
  const router = useRouter();
  const params = useLocalSearchParams();
  const rideId = params.id as string;

  // Primary States
  const [ride, setRide] = useState<Ride | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [expandedStopIndex, setExpandedStopIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  
  // Developer Proximity States
  const [simulatedDistance, setSimulatedDistance] = useState(1200); // meters to next stop

  // Modal UI States
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [isVerificationOpen, setIsVerificationOpen] = useState(false);
  const [isIncidentOpen, setIsIncidentOpen] = useState(false);
  
  // Passenger states
  const [selectedPassenger, setSelectedPassenger] = useState<Booking | null>(null);
  const [otpValue, setOtpValue] = useState('');
  const [qrScannerActive, setQrScannerActive] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  // Incident state
  const [incidentType, setIncidentType] = useState('Vehicle Issue');
  const [incidentDesc, setIncidentDesc] = useState('');
  const [auditLogs, setAuditLogs] = useState<string[]>([]);

  // Watch position reference
  const locationSubscriptionRef = useRef<any>(null);

  const addLog = (message: string) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setAuditLogs((prev) => [`[${timeStr}] ${message}`, ...prev.slice(0, 30)]);
  };

  useEffect(() => {
    if (rideId) {
      loadData();
    }
    return () => {
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
      }
    };
  }, [rideId]);

  useEffect(() => {
    setExpandedStopIndex(currentStopIndex);
  }, [currentStopIndex]);

  // Periodic polling for automated state transitions
  useEffect(() => {
    let interval: any = null;
    if (rideId && ride && ride.status === 'inprogress') {
      interval = setInterval(() => {
        loadData();
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [rideId, ride?.status]);

  // BG coordinates syncing
  useEffect(() => {
    const setupLiveTracking = async () => {
      if (!ride || ride.status !== 'inprogress') {
        if (locationSubscriptionRef.current) {
          locationSubscriptionRef.current.remove();
          locationSubscriptionRef.current = null;
        }
        return;
      }

      try {
        const hasPermission = await checkLocationPermission();
        if (!hasPermission) {
          const result = await requestLocationPermission();
          if (!result.granted) {
            addLog('⚠️ GPS sharing permission denied.');
            return;
          }
        }

        addLog('🗺️ Location tracker active.');
        locationSubscriptionRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 10000,
            distanceInterval: 10,
          },
          (location) => {
            const { latitude, longitude } = location.coords;
            updateTracking(ride.id, latitude, longitude);
            setDriverLocation({ latitude, longitude });
            addLog(`📍 GPS coordinate shared: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
          }
        );
      } catch (err) {
        console.error(err);
      }
    };

    setupLiveTracking();
  }, [ride?.status]);

  const loadData = async () => {
    try {
      const rideData = await getRideById(rideId);
      if (rideData) {
        setRide(rideData);
        
        const bookingsList = await bookingService.getRideBookings(rideId);
        const normalizedBookings = (bookingsList || []).map((b: any) => ({
          ...b,
          id: b.bookingId || b.id,
          status: (b.status || '').toLowerCase()
        }));
        setBookings(normalizedBookings as any);

        const generatedStops = (rideData.stops && rideData.stops.length > 0)
          ? rideData.stops.map((s: any) => {
              const stopBookings = normalizedBookings.filter((b: any) => b.id === s.bookingId || b.bookingId === s.bookingId);
              return {
                id: s.id,
                name: s.stopName,
                type: s.type === 0 ? 'pickup' : 'drop',
                address: s.address,
                coordinates: { latitude: s.latitude, longitude: s.longitude },
                passengerCount: stopBookings.length,
                seatsCount: stopBookings.reduce((sum, b) => sum + b.seats, 0),
                bookings: stopBookings,
                status: s.status === 3 ? 'completed' : (s.status === 1 || s.status === 2 ? 'current' : 'pending'),
                sequence: s.sequence
              };
            })
          : calculateStops(rideData, normalizedBookings);

        setStops(generatedStops);

        // Find current active stop in queue
        let stopIdx = generatedStops.findIndex(s => s.status !== 'completed');
        if (stopIdx === -1) {
          stopIdx = generatedStops.length > 0 ? generatedStops.length - 1 : 0;
        }
        setCurrentStopIndex(stopIdx);
      }
    } catch (e) {
      console.error(e);
      addLog('❌ Syncing error.');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateStops = (rideObj: Ride, bookingsList: any[]): Stop[] => {
    const stopsList: Stop[] = [];
    const activeBookings = bookingsList.filter(b => b.status !== 'cancelled');

    if (activeBookings.length <= 1) {
      stopsList.push({
        id: 'pickup_main',
        name: `${rideObj.from.address.split(',')[0]} Pickup`,
        type: 'pickup',
        address: rideObj.from.address,
        coordinates: rideObj.from.coordinates,
        passengerCount: activeBookings.length,
        seatsCount: activeBookings.reduce((sum, b) => sum + b.seats, 0),
        bookings: activeBookings,
        status: rideObj.status === 'inprogress' ? 'current' : 'pending',
      });
    } else {
      const mid = Math.ceil(activeBookings.length / 2);
      const stop1Bookings = activeBookings.slice(0, mid);
      const stop2Bookings = activeBookings.slice(mid);

      stopsList.push({
        id: 'pickup_1',
        name: `${rideObj.from.address.split(',')[0]} Pickup`,
        type: 'pickup',
        address: rideObj.from.address,
        coordinates: rideObj.from.coordinates,
        passengerCount: stop1Bookings.length,
        seatsCount: stop1Bookings.reduce((sum, b) => sum + b.seats, 0),
        bookings: stop1Bookings,
        status: rideObj.status === 'inprogress' ? 'current' : 'pending',
      });

      const offsetLat = rideObj.from.coordinates.latitude + (rideObj.to.coordinates.latitude - rideObj.from.coordinates.latitude) * 0.35;
      const offsetLng = rideObj.from.coordinates.longitude + (rideObj.to.coordinates.longitude - rideObj.from.coordinates.longitude) * 0.35;
      
      stopsList.push({
        id: 'pickup_2',
        name: 'Katraj Bypass Pickup',
        type: 'pickup',
        address: 'Katraj Bypass Highway, Pune',
        coordinates: { latitude: offsetLat, longitude: offsetLng },
        passengerCount: stop2Bookings.length,
        seatsCount: stop2Bookings.reduce((sum, b) => sum + b.seats, 0),
        bookings: stop2Bookings,
        status: 'pending',
      });
    }

    stopsList.push({
      id: 'drop_final',
      name: `${rideObj.to.address.split(',')[0]} Drop-off`,
      type: 'drop',
      address: rideObj.to.address,
      coordinates: rideObj.to.coordinates,
      passengerCount: activeBookings.length,
      seatsCount: activeBookings.reduce((sum, b) => sum + b.seats, 0),
      bookings: activeBookings,
      status: 'pending',
    });

    return stopsList;
  };

  const simulateLocationUpdate = async (type: 'far' | 'arrived') => {
    if (!ride) return;
    const activeStop = stops[currentStopIndex];
    if (!activeStop) return;

    setIsActionLoading(true);
    try {
      if (type === 'far') {
        const lat = activeStop.coordinates.latitude + 0.01;
        const lng = activeStop.coordinates.longitude + 0.01;
        await updateTracking(ride.id, lat, lng);
        setSimulatedDistance(1200);
        addLog(`📍 Simulating GPS Far: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      } else if (type === 'arrived') {
        const lat = activeStop.coordinates.latitude;
        const lng = activeStop.coordinates.longitude;
        await updateTracking(ride.id, lat, lng);
        setSimulatedDistance(0);
        addLog(`🚨 Simulating GPS Arrived (0m): ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        addLog('⚡ Backend geofence check executed!');
      }
      await loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setIsActionLoading(false);
    }
  };

  const getBookingOtp = (id: string) => {
    let hash = 0;
    const normalizedId = (id || '').toLowerCase();
    for (let i = 0; i < normalizedId.length; i++) {
      hash = normalizedId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const code = Math.abs(hash % 9000) + 1000;
    return code.toString();
  };

  const handleVerifyPassenger = async (method: 'otp' | 'qr' | 'manual', scannedToken?: string) => {
    const passengerToVerify = selectedPassenger || bookings.find(
      b => (b.id || '').toLowerCase() === (ride?.currentPassengerId || '').toLowerCase() || 
           (b.bookingId || '').toLowerCase() === (ride?.currentPassengerId || '').toLowerCase()
    );
    if (!passengerToVerify || !ride) return;
    setIsActionLoading(true);

    try {
      let success = false;
      if (method === 'otp') {
        if (!otpValue || otpValue.length < 4) {
          Alert.alert('Validation Error', 'Please enter a 4-digit code.');
          setIsActionLoading(false);
          return;
        }
        success = await verifyBooking(passengerToVerify.id, {
          verificationType: 'OTP',
          otp: otpValue
        });
      } else if (method === 'qr') {
        success = await verifyBooking(passengerToVerify.id, {
          verificationType: 'QR',
          qrToken: scannedToken
        });
      } else if (method === 'manual') {
        const expectedOtp = getBookingOtp(passengerToVerify.id);
        success = await verifyBooking(passengerToVerify.id, {
          verificationType: 'OTP',
          otp: expectedOtp
        });
      }

      if (success) {
        addLog(`✓ Passenger verified: ${passengerToVerify.passengerName}`);
        
        // Auto-complete the pickup stop immediately to transition Ride phase to next stop / EnRoute
        const activeStop = stops[currentStopIndex];
        if (activeStop) {
          addLog(`🏁 Auto-completing pickup stop: ${activeStop.name}`);
          await completeStop(ride.id, activeStop.id);
        }
        
        setIsVerificationOpen(false);
        setSelectedPassenger(null);
        setOtpValue('');
        await loadData();
      } else {
        Alert.alert('Verification Failed', 'Invalid verification payload or code. Please try again.');
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'An error occurred during verification.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDropConfirm = async () => {
    if (!ride) return;
    const activeStop = stops[currentStopIndex];
    if (!activeStop) return;

    setIsActionLoading(true);
    try {
      const ok = await completeStop(ride.id, activeStop.id);
      if (ok) {
        addLog(`✓ Drop-off completed for stop: ${activeStop.name}`);
        await loadData();
      } else {
        Alert.alert('Error', 'Failed to complete drop-off.');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsActionLoading(false);
    }
  };

  const startQrScanner = async () => {
    setScanned(false);
    setQrScannerActive(true);
    setIsVerificationOpen(true);
    
    if (!cameraPermission || !cameraPermission.granted) {
      try {
        const res = await requestCameraPermission();
        if (!res.granted) {
          addLog('⚠️ Camera permission denied.');
        } else {
          addLog('📷 Camera active for boarding pass scan.');
        }
      } catch (err) {
        console.error('Error requesting camera permission:', err);
      }
    }
  };

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (scanned) return;
    setScanned(true);
    
    addLog(`📷 Scanned barcode data: ${data}`);
    
    setQrScannerActive(false);
    setScanned(false);
    setIsVerificationOpen(false);
    await handleVerifyPassenger('qr', data);
  };

  const triggerSosAlert = () => {
    if (!ride) return;
    Alert.alert(
      '🛡️ TravelBuddy Safety Hub',
      'Select a safety incident report or trigger immediate emergency police alerts.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report Dispute / Incident',
          onPress: () => setIsIncidentOpen(true),
        },
        {
          text: '🚨 DIAL POLICE HELPLINE (100)',
          style: 'destructive',
          onPress: () => {
            addLog('🚨 SOS Broadcast dispatched. Hotlining call police.');
            Linking.openURL('tel:100').catch(() => {
              Alert.alert('SOS Triggered', 'Encrypted coordinates broadcasted.');
            });
          }
        }
      ]
    );
  };

  const handleReportIncident = () => {
    addLog(`⚠️ Incident logged: [${incidentType}] ${incidentDesc}`);
    setIsIncidentOpen(false);
    setIncidentDesc('');
    Alert.alert('Report Saved', 'Incident successfully dispatched to operations.');
  };

  const launchExternalMaps = () => {
    if (!stops[currentStopIndex]) return;
    const dest = stops[currentStopIndex];
    const url = Platform.select({
      ios: `maps://?daddr=${dest.coordinates.latitude},${dest.coordinates.longitude}&dirflg=d`,
      android: `google.navigation:q=${dest.coordinates.latitude},${dest.coordinates.longitude}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${dest.coordinates.latitude},${dest.coordinates.longitude}`,
    });
    Linking.openURL(url!).catch(() => Alert.alert('Error', 'Could not launch maps.'));
  };

  const currentPassengerBooking = bookings.find(
    b => (b.id || '').toLowerCase() === (ride?.currentPassengerId || '').toLowerCase() || 
         (b.bookingId || '').toLowerCase() === (ride?.currentPassengerId || '').toLowerCase()
  ) || null;

  const activeStop = stops[currentStopIndex];

  const renderHUDContent = () => {
    if (!ride) return null;

    const initials = currentPassengerBooking ? currentPassengerBooking.passengerName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '';

    if (ride.status === 'draft' || ride.status === 'published' || ride.status === 'scheduled') {
      return (
        <View style={styles.hudCardBody}>
          <Text style={styles.hudTitle}>Ready to Depart</Text>
          <Text style={styles.hudSubtitle}>Start the ride to initiate stops routing & tracking.</Text>
          <TouchableOpacity
            style={[styles.hudPrimaryBtn, { backgroundColor: '#10B981' }]}
            onPress={async () => {
              setIsActionLoading(true);
              const ok = await startRide(ride.id);
              setIsActionLoading(false);
              if (ok) {
                addLog('🏁 Ride started successfully!');
                await loadData();
              } else {
                Alert.alert('Error', 'Failed to start ride.');
              }
            }}
            disabled={isActionLoading}
          >
            <Play size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.hudBtnText}>Start Journey</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (ride.status === 'completed') {
      return (
        <View style={styles.hudCardBody}>
          <Text style={styles.hudTitle}>Journey Finished</Text>
          <Text style={styles.hudSubtitle}>You completed all drop-offs. Thank you for riding with TravelBuddy!</Text>
          <TouchableOpacity
            style={[styles.hudPrimaryBtn, { backgroundColor: '#4F46E5' }]}
            onPress={() => router.back()}
          >
            <ArrowLeft size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.hudBtnText}>Back to Dashboard</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (ride.status === 'inprogress') {
      switch (ride.currentPhase) {
        case 1: // NavigatingToPickup
          return (
            <View style={styles.hudCardBody}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.hudTitle}>Navigating to Pickup</Text>
                  <Text style={styles.hudAddress} numberOfLines={1}>
                    {activeStop ? activeStop.name : 'Next stop'}
                  </Text>
                  <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }} numberOfLines={1}>
                    {activeStop?.address}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.hudMiniNavBtn, { backgroundColor: '#4F46E5' }]}
                  onPress={launchExternalMaps}
                >
                  <Navigation size={12} color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: 'bold', marginLeft: 4 }}>Navigate</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <TouchableOpacity
                  style={[styles.hudSecondaryBtn, { flex: 1 }]}
                  onPress={() => simulateLocationUpdate('arrived')}
                >
                  <Compass size={14} color="#94A3B8" style={{ marginRight: 6 }} />
                  <Text style={[styles.hudBtnTextSecondary, { color: '#FFFFFF' }]}>Simulate Arrived (0m)</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        case 2: // PickingPassenger
          return (
            <View style={styles.hudCardBody}>
              <Text style={styles.hudTitle}>Passenger Boarding Check-In</Text>
              {currentPassengerBooking ? (
                <View style={styles.passengerVerifyBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <View style={styles.avatarCircleSmall}>
                      <Text style={styles.avatarTextSmall}>{initials}</Text>
                    </View>
                    <View>
                      <Text style={styles.verifyPassengerName}>{currentPassengerBooking.passengerName}</Text>
                      <Text style={styles.verifyPassengerSeats}>{currentPassengerBooking.seats} Seats Requested</Text>
                    </View>
                  </View>

                  <View style={styles.verifyFormRow}>
                    <TextInput
                      style={[styles.hudOtpInput, { color: '#FFFFFF', borderColor: '#334155' }]}
                      maxLength={4}
                      keyboardType="numeric"
                      placeholder="Enter OTP"
                      placeholderTextColor="#64748B"
                      value={otpValue}
                      onChangeText={setOtpValue}
                    />
                    <TouchableOpacity
                      style={[styles.hudVerifyBtn, { backgroundColor: '#10B981' }]}
                      onPress={() => handleVerifyPassenger('otp')}
                      disabled={isActionLoading}
                    >
                      <Text style={styles.hudBtnText}>Verify</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                    <TouchableOpacity
                      style={[styles.hudActionOutlineBtn, { flex: 1, borderColor: '#4F46E5' }]}
                      onPress={startQrScanner}
                    >
                      <Camera size={14} color="#818CF8" />
                      <Text style={{ fontSize: 11, color: '#818CF8', fontWeight: 'bold', marginLeft: 4 }}>Scan QR</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.hudActionOutlineBtn, { flex: 1, borderColor: '#10B981' }]}
                      onPress={() => handleVerifyPassenger('manual')}
                    >
                      <CheckCircle size={14} color="#34D399" />
                      <Text style={{ fontSize: 11, color: '#34D399', fontWeight: 'bold', marginLeft: 4 }}>Bypass</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <Text style={styles.hudSubtitle}>No boarding passenger selected by route sequence.</Text>
              )}
            </View>
          );
        case 3: // EnRoute
          return (
            <View style={styles.hudCardBody}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.hudTitle}>En Route to Drop-off</Text>
                  <Text style={styles.hudAddress} numberOfLines={1}>
                    {activeStop ? activeStop.name : 'Drop-off stop'}
                  </Text>
                  <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }} numberOfLines={1}>
                    {activeStop?.address}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.hudMiniNavBtn, { backgroundColor: '#4F46E5' }]}
                  onPress={launchExternalMaps}
                >
                  <Navigation size={12} color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: 'bold', marginLeft: 4 }}>Navigate</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <TouchableOpacity
                  style={[styles.hudSecondaryBtn, { flex: 1 }]}
                  onPress={() => simulateLocationUpdate('arrived')}
                >
                  <Compass size={14} color="#94A3B8" style={{ marginRight: 6 }} />
                  <Text style={[styles.hudBtnTextSecondary, { color: '#FFFFFF' }]}>Simulate Arrived (0m)</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        case 4: // DroppingPassenger
          return (
            <View style={styles.hudCardBody}>
              <Text style={styles.hudTitle}>Arrived at Destination</Text>
              {currentPassengerBooking ? (
                <View style={styles.passengerVerifyBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <View style={styles.avatarCircleSmall}>
                      <Text style={styles.avatarTextSmall}>{initials}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.verifyPassengerName}>{currentPassengerBooking.passengerName}</Text>
                      <Text style={styles.verifyPassengerSeats}>{currentPassengerBooking.seats} Seats dropped</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[styles.hudPrimaryBtn, { backgroundColor: '#F59E0B' }]}
                    onPress={() => handleDropConfirm()}
                    disabled={isActionLoading}
                  >
                    <CheckCircle size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.hudBtnText}>Confirm Passenger Dropped</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={styles.hudSubtitle}>No dropoff passenger details found.</Text>
              )}
            </View>
          );
        default:
          return (
            <View style={styles.hudCardBody}>
              <Text style={styles.hudTitle}>Driving In Progress</Text>
              <Text style={styles.hudSubtitle}>Please focus on road safety.</Text>
            </View>
          );
      }
    }

    return null;
  };

  if (isLoading || !ride) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.text }]}>Syncing Ride Command Center...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* 100% Viewport Map Background */}
      <View style={styles.fullScreenMap}>
        <RouteMap
          from={ride.from}
          to={ride.to}
          distance={ride.distance}
          duration={ride.duration}
          driverLocation={driverLocation}
          containerStyle={{ height: '100%', width: '100%', borderRadius: 0, borderWidth: 0 }}
        />
      </View>

      {/* Uber-Style Navigation HUD (Top Banner Overlay) */}
      <View style={styles.navigationHUD}>
        <View style={{ width: '100%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <TouchableOpacity 
              onPress={() => router.back()} 
              style={styles.hudBackBtn}
            >
              <ArrowLeft size={20} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity 
              activeOpacity={0.8}
              onLongPress={() => {
                setIsConsoleOpen(true);
                addLog('🛠️ Developer Simulator modal opened via secret gesture.');
              }}
              style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(255, 255, 255, 0.08)' }}
            >
              <Text style={{ fontSize: 10, fontWeight: '800', color: '#10B981', letterSpacing: 0.5 }}>
                TB-{ride.id.slice(-4).toUpperCase()}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={triggerSosAlert} 
              style={styles.hudSosBtn}
            >
              <ShieldAlert size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Dynamic HUD Content based on active state/phase */}
          {renderHUDContent()}
        </View>
      </View>

      {/* Unified Bottom Control Panel Sheet (BlaBlaCar Itinerary Style) */}
      <View style={[styles.unifiedBottomDrawer, { backgroundColor: theme.colors.card, borderTopColor: theme.colors.border }]}>
        {/* Subtle drag handle */}
        <View style={[styles.dragHandle, { backgroundColor: theme.colors.border }]} />

        {/* Drawer Header stats row */}
        <View style={styles.drawerHeaderStats}>
          <View style={styles.headerRouteBlock}>
            <Text style={[styles.routeDirectionText, { color: theme.colors.text }]}>
              Stops List ({stops.length})
            </Text>
            <Text style={[styles.routeSubtitleText, { color: theme.colors.textSecondary }]}>
              {ride.from.address.split(',')[0]} → {ride.to.address.split(',')[0]}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: theme.colors.primary + '15' }]}>
            <Text style={[styles.statusBadgeText, { color: theme.colors.primary }]}>
              {ride.status === 'inprogress' ? (ride.currentPhase === 2 ? 'BOARDING' : 'DRIVING') : ride.status.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* BlaBlaCar-Style Itinerary Timeline Scrollable */}
        <ScrollView style={styles.itineraryScrollView} showsVerticalScrollIndicator={false}>
          {stops.map((stop, idx) => {
            const isCurrent = idx === currentStopIndex;
            const isExpanded = idx === (expandedStopIndex !== null ? expandedStopIndex : currentStopIndex);
            const isCompleted = stop.status === 'completed';
            const isLast = idx === stops.length - 1;

            return (
              <View key={stop.id} style={styles.itineraryItemContainer}>
                {/* Left Timeline vertical tracker line */}
                <View style={styles.timelineColumn}>
                  <View 
                    style={[
                      styles.timelineDot, 
                      { 
                        backgroundColor: isCompleted ? '#10B981' : isCurrent ? '#4F46E5' : theme.colors.surface,
                        borderColor: isCompleted ? '#10B981' : isCurrent ? '#4F46E5' : theme.colors.border,
                      }
                    ]}
                  >
                    {isCompleted ? (
                      <CheckCircle size={10} color="#FFFFFF" />
                    ) : isCurrent ? (
                      <View style={styles.timelineActiveInnerDot} />
                    ) : null}
                  </View>
                  {!isLast && (
                    <View 
                      style={[
                        styles.timelineConnectorLine, 
                        { backgroundColor: isCompleted ? '#10B981' : theme.colors.border }
                      ]} 
                    />
                  )}
                </View>

                {/* Right Stop Milestone content */}
                <TouchableOpacity 
                  activeOpacity={0.8}
                  onPress={() => setExpandedStopIndex(idx)}
                  style={styles.stopContentColumn}
                >
                  <View style={styles.stopInfoRow}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.stopNameText, { color: theme.colors.text, opacity: isCompleted ? 0.6 : 1, fontWeight: isCurrent ? 'bold' : '600' }]}>
                          {stop.name}
                        </Text>
                        <View style={[
                          styles.stopTypePill, 
                          { backgroundColor: stop.type === 'pickup' ? '#4F46E515' : '#10B98115' }
                        ]}>
                          <Text style={[styles.stopTypePillText, { color: stop.type === 'pickup' ? '#4F46E5' : '#10B981' }]}>
                            {stop.type.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.stopAddressSubtext, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                        {stop.address}
                      </Text>
                    </View>
                  </View>

                  {/* Expanded active passenger checklist under current stop */}
                  {isExpanded && stop.bookings.length > 0 && (
                    <View style={styles.stopPassengersContainer}>
                      {stop.bookings.map((booking) => {
                        const isPending = booking.status === 'requested';
                        const boarded = ['verified', 'enroute', 'dropreached', 'waitingpassengerconfirmation', 'completed'].includes(booking.status);
                        const dropped = ['completed', 'waitingpassengerconfirmation'].includes(booking.status);
                        const initials = booking.passengerName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

                        return (
                          <View 
                            key={booking.id} 
                            style={[
                              styles.passengerRowCard, 
                              { 
                                backgroundColor: theme.colors.surface,
                                borderColor: isPending ? '#F59E0B50' : boarded || dropped ? '#10B98140' : theme.colors.border
                              }
                            ]}
                          >
                            {/* Avatar */}
                            <View style={[
                              styles.avatarCircle, 
                              { backgroundColor: isPending ? '#F59E0B15' : boarded || dropped ? '#10B98115' : '#4F46E515' }
                            ]}>
                              <Text style={[
                                  styles.avatarText, 
                                  { color: isPending ? '#F59E0B' : boarded || dropped ? '#10B981' : '#4F46E5' }
                                ]}
                              >
                                {initials}
                              </Text>
                            </View>

                            {/* Details */}
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.passengerNameText, { color: theme.colors.text }]}>
                                {booking.passengerName}
                              </Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 }}>
                                <Text style={[styles.passengerSeatsText, { color: theme.colors.textSecondary }]}>
                                  {booking.seats} {booking.seats === 1 ? 'Seat' : 'Seats'}
                                </Text>
                                {isPending && (
                                  <View style={{ backgroundColor: '#F59E0B20', paddingVertical: 1.5, paddingHorizontal: 6, borderRadius: 4 }}>
                                    <Text style={{ fontSize: 8, color: '#F59E0B', fontWeight: '900', letterSpacing: 0.2 }}>PENDING</Text>
                                  </View>
                                )}
                              </View>
                            </View>

                            {/* Actions */}
                             {(booking.status !== 'requested') && (
                               <View style={styles.quickContactRow}>
                                 <TouchableOpacity 
                                   style={[styles.contactIconBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
                                   onPress={() => Linking.openURL(`tel:${booking.passengerPhone}`).catch(() => Alert.alert('Error', 'Cannot dial number.'))}
                                 >
                                   <Phone size={12} color={theme.colors.textSecondary} />
                                 </TouchableOpacity>
                               </View>
                             )}

                            {/* Action Button */}
                            <TouchableOpacity 
                              style={[
                                styles.boardingStatusBtn, 
                                { 
                                  backgroundColor: isPending ? '#F59E0B' : (boarded || dropped) ? '#10B98115' : '#4F46E5',
                                  borderColor: (boarded || dropped) ? '#10B981' : 'transparent',
                                  borderWidth: 1,
                                }
                              ]}
                              onPress={async () => {
                                if (isPending) {
                                  Alert.alert(
                                    'Accept Booking Request',
                                    `Are you sure you want to accept and confirm the booking request from ${booking.passengerName}?`,
                                    [
                                      { text: 'Cancel', style: 'cancel' },
                                      {
                                        text: 'Accept & Confirm',
                                        onPress: async () => {
                                          setIsActionLoading(true);
                                          const ok = await confirmBooking(booking.id);
                                          setIsActionLoading(false);
                                          if (ok) {
                                            addLog(`✓ Accepted and confirmed booking: ${booking.passengerName}`);
                                            await loadData();
                                          } else {
                                            Alert.alert('Error', 'Failed to accept booking.');
                                          }
                                        }
                                      }
                                    ]
                                  );
                                } else if (stop.type === 'pickup') {
                                  if (!boarded) {
                                    setSelectedPassenger(booking);
                                    setIsVerificationOpen(true);
                                  }
                                } else {
                                  if (!dropped) {
                                    setSelectedPassenger(booking);
                                    handleDropConfirm();
                                  }
                                }
                              }}
                            >
                              <Text 
                                style={[
                                  styles.boardingStatusBtnText, 
                                  { color: isPending ? '#FFFFFF' : (boarded || dropped) ? '#10B981' : '#FFFFFF', fontWeight: 'bold' }
                                ]}
                              >
                                {isPending ? 'Accept' : stop.type === 'pickup' 
                                  ? (boarded ? 'Boarded ✓' : 'Verify') 
                                  : (dropped ? 'Dropped ✓' : 'Confirm')
                                }
                              </Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {/* Summary of passengers if the stop is NOT current */}
                  {!isExpanded && stop.bookings.length > 0 && (
                    <Text style={[styles.itinerarySummaryText, { color: theme.colors.textSecondary }]}>
                      {isCompleted ? '✓ All bookings checked' : `${stop.bookings.length} passenger(s) listed`}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>

        {/* Est Earnings Info Section at the bottom */}
        <View style={styles.bottomDrawerFooter}>
          <View style={styles.footerPayoutSection}>
            <TrendingUp size={14} color="#10B981" style={{ marginRight: 6 }} />
            <Text style={[styles.footerPayoutText, { color: '#10B981' }]}>
              Est. Ride Earnings: {formatPrice(bookings.filter(b => b.status !== 'cancelled' && b.status !== 'rejected').reduce((sum, b) => sum + b.totalPrice, 0))}
            </Text>
          </View>
        </View>
      </View>

      {/* Safety incident reports Modal */}
      <Modal visible={isIncidentOpen} animationType="slide" transparent={true}>
        <View style={styles.overlayModalBg}>
          <View style={[styles.incidentFormCard, { backgroundColor: theme.colors.card }]}>
            <View style={styles.modalHeaderRow}>
              <ShieldAlert size={22} color={theme.colors.error} />
              <Text style={[styles.modalHeaderTitle, { color: theme.colors.text }]}>Incident Dispatch Report</Text>
              <TouchableOpacity onPress={() => setIsIncidentOpen(false)} style={styles.modalCloseBtn}>
                <Text style={{ fontSize: 24, color: theme.colors.textSecondary }}>×</Text>
              </TouchableOpacity>
            </View>

            <View style={{ gap: 14 }}>
              <Text style={[styles.formLabel, { color: theme.colors.text }]}>Incident Severity Type</Text>
              <View style={styles.incidentChipRow}>
                {['Vehicle Issue', 'Medical Need', 'Passenger Conflict'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeSelectChip, { backgroundColor: incidentType === type ? theme.colors.error + '15' : theme.colors.surface, borderColor: incidentType === type ? theme.colors.error : theme.colors.border }]}
                    onPress={() => setIncidentType(type)}
                  >
                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: incidentType === type ? theme.colors.error : theme.colors.text }}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.formLabel, { color: theme.colors.text }]}>Describe what happened</Text>
              <TextInput
                style={[styles.descInputText, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="Details of the operational issue..."
                placeholderTextColor={theme.colors.textSecondary}
                multiline
                numberOfLines={3}
                value={incidentDesc}
                onChangeText={setIncidentDesc}
              />

              <TouchableOpacity style={[styles.primaryCTA, { backgroundColor: theme.colors.error, marginTop: 10 }]} onPress={handleReportIncident}>
                <Text style={styles.primaryCTAText}>Submit Emergency Report</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Developer Proximity simulator settings and live console modal */}
      <Modal visible={isConsoleOpen} animationType="slide" transparent={true}>
        <View style={styles.overlayModalBg}>
          <View style={[styles.incidentFormCard, { backgroundColor: theme.colors.card, height: height * 0.6 }]}>
            <View style={styles.modalHeaderRow}>
              <Compass size={22} color={theme.colors.primary} />
              <Text style={[styles.modalHeaderTitle, { color: theme.colors.text }]}>Console Settings & Proximity Sim</Text>
              <TouchableOpacity onPress={() => setIsConsoleOpen(false)} style={styles.modalCloseBtn}>
                <Text style={{ fontSize: 24, color: theme.colors.textSecondary }}>×</Text>
              </TouchableOpacity>
            </View>

            {/* Simulated preset buttons */}
            <View style={styles.simBox}>
              <Text style={[styles.simBoxTitle, { color: theme.colors.text }]}>🛠️ Simulate Geofencing Radius</Text>
              <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>Current distance to next stop: {simulatedDistance}m</Text>
              <View style={styles.simPresetRow}>
                <TouchableOpacity style={[styles.simPresetBtn, { backgroundColor: theme.colors.accent + '20', borderColor: theme.colors.accent, borderWidth: 1 }]} onPress={() => simulateLocationUpdate('far')}>
                  <Text style={{ fontSize: 11, color: theme.colors.accent, fontWeight: 'bold' }}>Far (1.2km)</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.simPresetBtn, { backgroundColor: theme.colors.accent }]} onPress={() => simulateLocationUpdate('arrived')}>
                  <Text style={{ fontSize: 11, color: '#FFFFFF', fontWeight: 'bold' }}>Arrived (0m)</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.consoleBlock, { backgroundColor: '#0F172A' }]}>
              <Text style={styles.consoleHeaderLine}>BROADCAST EVENT STREAM LOGS</Text>
              <ScrollView>
                {auditLogs.map((log, idx) => (
                  <Text key={idx} style={styles.consoleLineText}>{log}</Text>
                ))}
                {auditLogs.length === 0 && <Text style={{ fontStyle: 'italic', color: '#94A3B8', fontSize: 11 }}>Listening to system lifecycle logs...</Text>}
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>

      {/* Passenger Boarding Verification Modal */}
      <Modal 
        visible={isVerificationOpen} 
        animationType="fade" 
        transparent={true}
        onRequestClose={() => setIsVerificationOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.overlayModalBg}>
            <View style={[styles.passengerVerifyModalCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <ScrollView
                bounces={false}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {selectedPassenger && (
                  <View style={styles.pVerifyHeader}>
                    <View>
                      <Text style={[styles.pVerifyNameText, { color: theme.colors.text }]}>{selectedPassenger.passengerName}</Text>
                      <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>Seats: {selectedPassenger.seats} | Phone: {selectedPassenger.passengerPhone}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setIsVerificationOpen(false)} style={styles.modalCloseBtn}>
                      <Text style={{ fontSize: 24, color: theme.colors.textSecondary }}>×</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {!qrScannerActive ? (
                  <View style={{ gap: 16, marginTop: 12 }}>
                    <View>
                      <Text style={[styles.formLabel, { color: theme.colors.text }]}>Enter 4-Digit Boarding OTP Code</Text>
                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                        <TextInput
                          style={[styles.otpCodeInput, { borderColor: theme.colors.border, color: theme.colors.text, backgroundColor: theme.colors.surface }]}
                          maxLength={4}
                          keyboardType="numeric"
                          placeholder="****"
                          placeholderTextColor={theme.colors.textSecondary}
                          value={otpValue}
                          onChangeText={setOtpValue}
                        />
                        <TouchableOpacity style={[styles.otpSubmitBtn, { backgroundColor: theme.colors.primary }]} onPress={() => handleVerifyPassenger('otp')}>
                          <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Verify OTP</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />

                    <TouchableOpacity style={[styles.verifyMethodBtn, { borderColor: theme.colors.border }]} onPress={startQrScanner}>
                      <Camera size={16} color={theme.colors.text} style={{ marginRight: 8 }} />
                      <Text style={[styles.verifyMethodBtnText, { color: theme.colors.text }]}>Scan QR Passcode</Text>
                    </TouchableOpacity>

                    <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />

                    <TouchableOpacity style={[styles.verifyMethodBtn, { borderColor: theme.colors.success, backgroundColor: theme.colors.success + '10' }]} onPress={() => handleVerifyPassenger('manual')}>
                      <CheckCircle size={16} color={theme.colors.success} style={{ marginRight: 8 }} />
                      <Text style={[styles.verifyMethodBtnText, { color: theme.colors.success }]}>ID Check manual bypass</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.cameraContainer}>
                    {(!cameraPermission || !cameraPermission.granted) ? (
                      <View style={styles.cameraPermissionBox}>
                        <Text style={[styles.permissionText, { color: theme.colors.text, textAlign: 'center', marginBottom: 12 }]}>
                          Camera permission is required to scan boarding passes.
                        </Text>
                        <TouchableOpacity 
                          style={[styles.grantBtn, { backgroundColor: theme.colors.primary }]}
                          onPress={async () => {
                            const res = await requestCameraPermission();
                            if (!res.granted) {
                              Alert.alert('Permission Denied', 'You need to grant camera access to scan QR codes.');
                            }
                          }}
                        >
                          <Text style={styles.grantBtnText}>Grant Permission</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.cameraBox}>
                        <CameraView
                          style={StyleSheet.absoluteFillObject}
                          barcodeScannerSettings={{
                            barcodeTypes: ['qr'],
                          }}
                          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                        />
                        {/* Visual Scan overlay */}
                        <View style={styles.scanOverlay}>
                          <View style={styles.scanBounds}>
                            <View style={styles.scanHorizontalLaser} />
                          </View>
                          <Text style={styles.scanHelpText}>Align QR code inside frame</Text>
                        </View>
                      </View>
                    )}
                    
                    <TouchableOpacity 
                      style={[styles.cancelScanBtn, { backgroundColor: theme.colors.error + '20', borderColor: theme.colors.error, borderWidth: 1 }]} 
                      onPress={() => {
                        setQrScannerActive(false);
                        setScanned(false);
                      }}
                    >
                      <Text style={{ color: theme.colors.error, fontWeight: 'bold' }}>Cancel Scan</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  fullScreenMap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Uber-Style Navigation HUD Banner
  navigationHUD: {
    position: 'absolute',
    top: 50,
    left: 12,
    right: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#0B0F19',
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 10,
  },
  hudBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hudDirectionsBlock: {
    flex: 1,
    marginHorizontal: 14,
  },
  hudInstructionText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  hudStopAddress: {
    fontSize: 11,
    marginTop: 2,
    color: '#94A3B8',
    fontWeight: '500',
  },
  hudSosBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },

  // Bottom Control Panel Drawer
  unifiedBottomDrawer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    height: height * 0.3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 10,
    zIndex: 10,
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 12,
    opacity: 0.4,
  },
  drawerHeaderStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerRouteBlock: {
    flex: 1,
  },
  routeDirectionText: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  routeSubtitleText: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  // BlaBlaCar Itinerary Vertical timeline track styling
  itineraryScrollView: {
    flex: 1,
    marginTop: 4,
    marginBottom: 8,
  },
  itineraryItemContainer: {
    flexDirection: 'row',
    minHeight: 64,
  },
  timelineColumn: {
    width: 28,
    alignItems: 'center',
    position: 'relative',
  },
  timelineDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    zIndex: 2,
  },
  timelineActiveInnerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  timelineConnectorLine: {
    width: 2,
    position: 'absolute',
    top: 20,
    bottom: -10,
    zIndex: 1,
  },
  stopContentColumn: {
    flex: 1,
    paddingLeft: 8,
    paddingBottom: 16,
  },
  stopInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  stopNameText: {
    fontSize: 14,
    letterSpacing: -0.1,
  },
  stopTypePill: {
    paddingVertical: 1.5,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  stopTypePillText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  stopAddressSubtext: {
    fontSize: 11,
    marginTop: 1,
  },
  itineraryNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  itineraryNavBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },
  itinerarySummaryText: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500',
  },

  // Stop Expanded passenger checks container
  stopPassengersContainer: {
    marginTop: 10,
    gap: 6,
  },
  passengerRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 11,
    fontWeight: '700',
  },
  passengerNameText: {
    fontSize: 13,
    fontWeight: '700',
  },
  passengerSeatsText: {
    fontSize: 11,
    fontWeight: '500',
  },
  quickContactRow: {
    flexDirection: 'row',
    gap: 6,
  },
  contactIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  boardingStatusBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    minWidth: 74,
    alignItems: 'center',
  },
  boardingStatusBtnText: {
    fontSize: 11,
  },

  // CTA styles
  ctaWrapper: {
    marginTop: 2,
  },
  primaryCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  primaryCTAText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusBannerText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Footer stats row
  bottomDrawerFooter: {
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 6,
  },
  footerPayoutSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerPayoutText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Modal styles
  overlayModalBg: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  incidentFormCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    width: '100%',
    padding: 24,
    gap: 14,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
    letterSpacing: -0.2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  incidentChipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typeSelectChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  descInputText: {
    height: 80,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    textAlignVertical: 'top',
    fontSize: 13,
  },

  // Proximity simulator styles
  simBox: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    gap: 6,
  },
  simBoxTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  simPresetRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  simPresetBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  consoleBlock: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
  },
  consoleHeaderLine: {
    color: '#38BDF8',
    fontSize: 9,
    fontWeight: '800',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(56, 189, 248, 0.15)',
    paddingBottom: 4,
    marginBottom: 6,
  },
  consoleLineText: {
    color: '#F8FAFC',
    fontSize: 10,
    lineHeight: 13,
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace' }),
  },

  // Verification dialog overlays
  passengerVerifyModalCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    width: '100%',
    padding: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  pVerifyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  pVerifyNameText: {
    fontSize: 16,
    fontWeight: '800',
  },
  otpCodeInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 4,
    height: 44,
  },
  otpSubmitBtn: {
    flex: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
  },
  dividerLine: {
    height: 1,
    opacity: 0.3,
  },
  verifyMethodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
  },
  verifyMethodBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cameraContainer: {
    gap: 12,
    marginTop: 12,
  },
  cameraPermissionBox: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F3F4F610',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB20',
  },
  permissionText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  grantBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 8,
  },
  grantBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  cameraBox: {
    height: 220,
    backgroundColor: '#000000',
    borderRadius: 14,
    position: 'relative',
    overflow: 'hidden',
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  scanHelpText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 10,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cancelScanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 6,
  },
  cameraBoxMock: {
    height: 180,
    backgroundColor: '#000000',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  scanBounds: {
    width: 100,
    height: 100,
    borderWidth: 2,
    borderColor: '#38BDF8',
    borderRadius: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  scanHorizontalLaser: {
    position: 'absolute',
    width: '100%',
    height: 2,
    backgroundColor: '#38BDF8',
    top: '40%',
  },
  hudCardBody: {
    marginTop: 10,
    gap: 8,
    width: '100%',
  },
  hudTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  hudSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  hudAddress: {
    fontSize: 12,
    color: '#38BDF8',
    fontWeight: '600',
    marginTop: 2,
  },
  hudPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    width: '100%',
    marginTop: 6,
  },
  hudSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  hudBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  hudBtnTextSecondary: {
    fontSize: 12,
    fontWeight: '600',
  },
  hudMiniNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  passengerVerifyBox: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 10,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  avatarCircleSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#4F46E530',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarTextSmall: {
    fontSize: 10,
    fontWeight: '700',
    color: '#818CF8',
  },
  verifyPassengerName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  verifyPassengerSeats: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '500',
  },
  verifyFormRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  hudOtpInput: {
    flex: 2,
    height: 38,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 2,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  hudVerifyBtn: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hudActionOutlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
});
