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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRides, Ride, Booking } from '@/contexts/RideContext';
import RouteMap from '@/components/RouteMap';
import { bookingService } from '@/services/booking.service';
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
    arriveAtPickup,
    startBoarding,
    transitionEnRoute,
    completeDropoff,
    completeRide,
    updateTracking,
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
  const [autoArrivalTriggered, setAutoArrivalTriggered] = useState(false);

  // Modal UI States
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [isVerificationOpen, setIsVerificationOpen] = useState(false);
  const [isIncidentOpen, setIsIncidentOpen] = useState(false);
  
  // Passenger states
  const [selectedPassenger, setSelectedPassenger] = useState<Booking | null>(null);
  const [otpValue, setOtpValue] = useState('');
  const [qrScannerActive, setQrScannerActive] = useState(false);
  const [mockQrScanning, setMockQrScanning] = useState(false);
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

  // BG coordinates syncing
  useEffect(() => {
    const setupLiveTracking = async () => {
      if (!ride || ride.status !== 'started') {
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
    setIsLoading(true);
    try {
      const rideData = await getRideById(rideId);
      if (rideData) {
        setRide(rideData);
        addLog(`✅ Ride synced: status [${rideData.status}]`);
        
        const bookingsList = await bookingService.getRideBookings(rideId);
        const normalizedBookings = (bookingsList || []).map((b: any) => ({
          ...b,
          id: b.bookingId || b.id,
          status: (b.status || '').toLowerCase()
        }));
        setBookings(normalizedBookings as any);

        const generatedStops = calculateStops(rideData, normalizedBookings);
        setStops(generatedStops);

        // Sequence current stop
        let stopIdx = 0;
        if (generatedStops.length > 1) {
          if (['started'].includes(rideData.status)) {
            const stop1Pending = generatedStops[0].bookings.some(b => b.status === 'confirmed');
            stopIdx = stop1Pending ? 0 : 1;
          } else if (['enroute', 'dropcompleted', 'completed'].includes(rideData.status)) {
            stopIdx = generatedStops.length - 1;
          }
        }
        setCurrentStopIndex(stopIdx);
        setExpandedStopIndex(stopIdx);
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
        status: ['driverarrived', 'boarding', 'started'].includes(rideObj.status) ? 'current' : 
                ['enroute', 'dropcompleted', 'completed'].includes(rideObj.status) ? 'completed' : 'pending',
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
        status: rideObj.status === 'driverarrived' || rideObj.status === 'boarding' ? 'current' :
                ['started', 'enroute', 'dropcompleted', 'completed'].includes(rideObj.status) ? 'completed' : 'pending',
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
        status: rideObj.status === 'started' ? 'current' :
                ['enroute', 'dropcompleted', 'completed'].includes(rideObj.status) ? 'completed' : 'pending',
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
      status: rideObj.status === 'enroute' ? 'current' :
              rideObj.status === 'dropcompleted' || rideObj.status === 'completed' ? 'completed' : 'pending',
    });

    return stopsList;
  };

  const triggerStateTransition = async (action: string) => {
    if (!ride) return;
    setIsActionLoading(true);
    let success = false;

    try {
      switch (action) {
        case 'arrive':
          success = await arriveAtPickup(ride.id, driverLocation?.latitude, driverLocation?.longitude);
          if (success) addLog('🚀 Marked arrived at pickup.');
          break;
        case 'boarding':
          success = await startBoarding(ride.id);
          if (success) addLog('📋 Boarding checked-in active.');
          break;
        case 'start':
          success = await startRide(ride.id);
          if (success) addLog('🏁 Ride started! Location watcher active.');
          break;
        case 'enroute':
          success = await transitionEnRoute(ride.id);
          if (success) addLog('🚗 Ride en route.');
          break;
        case 'complete_drops':
          success = await completeDropoff(ride.id);
          if (success) addLog('🏁 Drop-offs marked complete.');
          break;
        case 'finalize':
          success = await completeRide(ride.id);
          if (success) addLog('🏆 Ride finalized.');
          break;
      }

      if (success) {
        await loadData();
      } else {
        Alert.alert('Error', 'State mutation failed.');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleProximityChange = async (distance: number) => {
    setSimulatedDistance(distance);
    
    if (distance <= 500 && !autoArrivalTriggered && ride && ['active', 'scheduled', 'published', 'confirmed'].includes(ride.status)) {
      setAutoArrivalTriggered(true);
      addLog('🚨 Simulated proximity arrival (<500m) triggered.');
      setIsActionLoading(true);
      const success = await arriveAtPickup(ride.id, ride.from.coordinates.latitude, ride.from.coordinates.longitude);
      setIsActionLoading(false);
      
      if (success) {
        addLog('🔔 Passenger arrival push notified.');
        Alert.alert('Arrival Notification', 'Arrived state triggered and passenger notified automatically.');
        await loadData();
      }
    }
  };

  const getBookingOtp = (id: string) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const code = Math.abs(hash % 9000) + 1000;
    return code.toString();
  };

  const handleVerifyPassenger = async (method: 'otp' | 'qr' | 'manual') => {
    if (!selectedPassenger || !ride) return;
    setIsActionLoading(true);

    try {
      if (method === 'otp') {
        if (!otpValue || otpValue.length < 4) {
          Alert.alert('Validation Error', 'Please enter a 4-digit code.');
          setIsActionLoading(false);
          return;
        }
        const expectedOtp = getBookingOtp(selectedPassenger.id);
        if (otpValue !== expectedOtp) {
          Alert.alert('Verification Failed', 'The boarding OTP code entered is incorrect. Please try again.');
          setIsActionLoading(false);
          return;
        }
      }

      let success = false;
      if (stops[currentStopIndex]?.type === 'pickup') {
        success = await bookingService.confirmBooking(selectedPassenger.id);
        if (success) addLog(`✓ Passenger boarded: ${selectedPassenger.passengerName}`);
      } else {
        success = await bookingService.completeBooking(selectedPassenger.id);
        if (success) addLog(`✓ Passenger dropped: ${selectedPassenger.passengerName}`);
      }

      if (success) {
        setIsVerificationOpen(false);
        setSelectedPassenger(null);
        setOtpValue('');
        await loadData();
      } else {
        Alert.alert('Error', 'Check-in verification failed.');
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
    if (scanned || !selectedPassenger) return;
    setScanned(true);
    
    addLog(`📷 Scanned barcode data: ${data}`);
    
    if (data === selectedPassenger.id) {
      Alert.alert(
        'Check-In Successful',
        `Boarding pass for ${selectedPassenger.passengerName} verified successfully via QR code scan!`,
        [
          {
            text: 'OK',
            onPress: async () => {
              setQrScannerActive(false);
              setScanned(false);
              await handleVerifyPassenger('qr');
            }
          }
        ]
      );
    } else {
      Alert.alert(
        'Invalid Ticket',
        'This QR code does not match this passenger\'s active Booking ID. Please scan their correct Boarding Pass screen.',
        [
          {
            text: 'Try Again',
            onPress: () => setScanned(false)
          }
        ]
      );
    }
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

  const triggerBoardingPrompt = (booking: Booking) => {
    Alert.alert(
      'Passenger Boarding Check-In',
      `Select boarding option for ${booking.passengerName}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Quick Check-in (ID Bypass)',
          onPress: async () => {
            setIsActionLoading(true);
            const ok = await bookingService.confirmBooking(booking.id);
            setIsActionLoading(false);
            if (ok) {
              addLog(`✓ Instant manual boarded: ${booking.passengerName}`);
              await loadData();
            }
          }
        },
        {
          text: 'Advanced OTP / QR Verify',
          onPress: () => {
            setSelectedPassenger(booking);
            setIsVerificationOpen(true);
          }
        }
      ]
    );
  };

  const triggerDropoffPrompt = (booking: Booking) => {
    Alert.alert(
      'Passenger Drop-off Confirmation',
      `Confirm drop-off for ${booking.passengerName}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Quick Drop Confirm',
          onPress: async () => {
            setIsActionLoading(true);
            const ok = await bookingService.completeBooking(booking.id);
            setIsActionLoading(false);
            if (ok) {
              addLog(`✓ Instant manual dropped: ${booking.passengerName}`);
              await loadData();
            }
          }
        },
        {
          text: 'Verify Details',
          onPress: () => {
            setSelectedPassenger(booking);
            setIsVerificationOpen(true);
          }
        }
      ]
    );
  };

  const activeStop = stops[currentStopIndex];

  // Boarding Lock logic:
  // If active stop is pickup and status is boarding, check if there are unverified passengers.
  const pendingBoardingsCount = activeStop?.type === 'pickup' && ride?.status === 'boarding'
    ? activeStop.bookings.filter(b => b.status === 'confirmed').length
    : 0;

  // Drop-off Check logic:
  // If active stop is drop and status is enroute, check if there are passengers still on-board.
  const pendingDropsCount = activeStop?.type === 'drop' && ride?.status === 'enroute'
    ? activeStop.bookings.filter(b => b.status !== 'completed').length
    : 0;

  const renderCTA = () => {
    if (!ride) return null;
    switch (ride.status) {
      case 'active':
      case 'scheduled':
      case 'published':
      case 'confirmed':
      case 'seatsbooked':
        return (
          <TouchableOpacity 
            style={[styles.primaryCTA, { backgroundColor: theme.colors.primary }]} 
            onPress={() => triggerStateTransition('arrive')} 
            disabled={isActionLoading}
          >
            <MapPin size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.primaryCTAText}>Arrived at Pickup</Text>
          </TouchableOpacity>
        );
      case 'driverarrived':
        return (
          <TouchableOpacity 
            style={[styles.primaryCTA, { backgroundColor: '#4F46E5' }]} 
            onPress={() => triggerStateTransition('boarding')} 
            disabled={isActionLoading}
          >
            <Users size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.primaryCTAText}>Notify Passengers & Start Boarding</Text>
          </TouchableOpacity>
        );
      case 'boarding':
        if (pendingBoardingsCount > 0) {
          return (
            <TouchableOpacity 
              style={[styles.primaryCTA, { backgroundColor: '#4F46E5', shadowColor: '#4F46E5', shadowOpacity: 0.2 }]} 
              onPress={() => {
                const firstPending = activeStop?.bookings.find(b => b.status === 'confirmed');
                if (firstPending) {
                  setSelectedPassenger(firstPending);
                  setIsVerificationOpen(true);
                } else {
                  Alert.alert('Boarding Required', `Please check-in the remaining ${pendingBoardingsCount} passenger(s) using their cards above.`);
                }
              }}
              disabled={isActionLoading}
            >
              <Users size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.primaryCTAText}>Verify Boarding Pass ({pendingBoardingsCount} Left)</Text>
            </TouchableOpacity>
          );
        } else {
          return (
            <TouchableOpacity 
              style={[styles.primaryCTA, { backgroundColor: '#10B981', shadowColor: '#10B981', shadowOpacity: 0.3 }]} 
              onPress={() => triggerStateTransition('start')} 
              disabled={isActionLoading}
            >
              <Play size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.primaryCTAText}>Start Trip & Depart Station</Text>
            </TouchableOpacity>
          );
        }
      case 'started':
        const extraPickups = stops.some((s, idx) => s.type === 'pickup' && s.status === 'pending');
        return (
          <TouchableOpacity
            style={[styles.primaryCTA, { backgroundColor: '#4F46E5' }]}
            onPress={() => {
              if (extraPickups) {
                const next = stops.findIndex(s => s.type === 'pickup' && s.status === 'pending');
                setCurrentStopIndex(next);
              } else {
                triggerStateTransition('enroute');
              }
            }}
            disabled={isActionLoading}
          >
            <Car size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.primaryCTAText}>{extraPickups ? 'Drive to Next Stop' : 'Transition to En Route'}</Text>
          </TouchableOpacity>
        );
      case 'enroute':
        if (pendingDropsCount > 0) {
          return (
            <TouchableOpacity 
              style={[styles.primaryCTA, { backgroundColor: '#F59E0B' }]} 
              onPress={() => triggerStateTransition('complete_drops')} 
              disabled={isActionLoading}
            >
              <CheckCircle size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.primaryCTAText}>Confirm Drop-offs Completed ({pendingDropsCount} Left)</Text>
            </TouchableOpacity>
          );
        } else {
          return (
            <TouchableOpacity 
              style={[styles.primaryCTA, { backgroundColor: '#10B981' }]} 
              onPress={() => triggerStateTransition('complete_drops')} 
              disabled={isActionLoading}
            >
              <CheckCircle size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.primaryCTAText}>Complete Final Drop-off</Text>
            </TouchableOpacity>
          );
        }
      case 'dropcompleted':
        return (
          <TouchableOpacity 
            style={[styles.primaryCTA, { backgroundColor: '#10B981' }]} 
            onPress={() => triggerStateTransition('finalize')} 
            disabled={isActionLoading}
          >
            <CheckCircle size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.primaryCTAText}>Finalize & Collect Earnings</Text>
          </TouchableOpacity>
        );
      case 'completed':
        return (
          <View style={[styles.statusBanner, { backgroundColor: theme.colors.success + '15', borderColor: theme.colors.success }]}>
            <CheckCircle size={20} color={theme.colors.success} style={{ marginRight: 8 }} />
            <Text style={[styles.statusBannerText, { color: theme.colors.success }]}>Journey Completed Successfully</Text>
          </View>
        );
      default:
        return null;
    }
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
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={styles.hudBackBtn}
        >
          <ArrowLeft size={20} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.hudDirectionsBlock}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Navigation size={15} color="#10B981" style={{ transform: [{ rotate: '45deg' }] }} />
            <Text style={styles.hudInstructionText} numberOfLines={1}>
              {ride.status === 'boarding' ? 'Boarding Check-In Active' : 
               ride.status === 'enroute' ? 'En Route to Final Drop-off' : 
               activeStop ? `Head toward ${activeStop.name}` : 'Navigating'}
            </Text>
          </View>
          <Text style={styles.hudStopAddress} numberOfLines={1}>
            {activeStop ? activeStop.address : ride.to.address}
          </Text>
        </View>

        <TouchableOpacity 
          onPress={triggerSosAlert} 
          style={styles.hudSosBtn}
        >
          <ShieldAlert size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Unified Bottom Control Panel Sheet (BlaBlaCar Itinerary Style) */}
      <View style={[styles.unifiedBottomDrawer, { backgroundColor: theme.colors.card, borderTopColor: theme.colors.border }]}>
        {/* Subtle drag handle */}
        <View style={[styles.dragHandle, { backgroundColor: theme.colors.border }]} />

        {/* Drawer Header stats row */}
        <View style={styles.drawerHeaderStats}>
          <View style={styles.headerRouteBlock}>
            <Text style={[styles.routeDirectionText, { color: theme.colors.text }]}>
              {ride.from.address.split(',')[0]} → {ride.to.address.split(',')[0]}
            </Text>
            
            {/* Long-press secret developer trigger */}
            <TouchableOpacity 
              activeOpacity={0.8}
              onLongPress={() => {
                setIsConsoleOpen(true);
                addLog('🛠️ Developer Simulator modal opened via secret gesture.');
              }}
            >
              <Text style={[styles.routeSubtitleText, { color: theme.colors.textSecondary }]}>
                Ride ID #TB-{ride.id.slice(-4).toUpperCase()} · {stops.length} Stops 💡
              </Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: theme.colors.primary + '15' }]}>
            <Text style={[styles.statusBadgeText, { color: theme.colors.primary }]}>{ride.status.toUpperCase()}</Text>
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

                    {isExpanded && !isCompleted && (
                      <TouchableOpacity 
                        style={[styles.itineraryNavBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
                        onPress={launchExternalMaps}
                      >
                        <Navigation size={14} color="#4F46E5" />
                        <Text style={styles.itineraryNavBtnText}>Navigate</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Expanded active passenger checklist under current stop */}
                  {isExpanded && stop.bookings.length > 0 && (
                    <View style={styles.stopPassengersContainer}>
                      {stop.bookings.map((booking) => {
                        const isPending = booking.status === 'pending';
                        const boarded = booking.status === 'confirmed' && ride.status === 'started' || booking.status === 'completed';
                        const dropped = booking.status === 'completed';
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
                            <View style={styles.quickContactRow}>
                              <TouchableOpacity 
                                style={[styles.contactIconBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
                                onPress={() => Linking.openURL(`tel:${booking.passengerPhone}`).catch(() => Alert.alert('Error', 'Cannot dial number.'))}
                              >
                                <Phone size={12} color={theme.colors.textSecondary} />
                              </TouchableOpacity>
                              <TouchableOpacity 
                                style={[styles.contactIconBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
                                onPress={() => Linking.openURL(`sms:${booking.passengerPhone}`).catch(() => Alert.alert('Error', 'Cannot send SMS.'))}
                              >
                                <MessageCircle size={12} color={theme.colors.textSecondary} />
                              </TouchableOpacity>
                            </View>

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
                                          const ok = await bookingService.confirmBooking(booking.id);
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
                                    triggerDropoffPrompt(booking);
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

        {/* Primary Action Button Area */}
        <View style={styles.ctaWrapper}>
          {renderCTA()}
        </View>

        {/* Est Earnings Info Section at the bottom */}
        <View style={styles.bottomDrawerFooter}>
          <View style={styles.footerPayoutSection}>
            <TrendingUp size={14} color="#10B981" style={{ marginRight: 6 }} />
            <Text style={[styles.footerPayoutText, { color: '#10B981' }]}>
              Est. Ride Earnings: ${(bookings.filter(b => b.status !== 'cancelled').reduce((sum, b) => sum + b.totalPrice, 0)).toFixed(2)}
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
                <TouchableOpacity style={[styles.simPresetBtn, { backgroundColor: theme.colors.accent + '20', borderColor: theme.colors.accent, borderWidth: 1 }]} onPress={() => handleProximityChange(1200)}>
                  <Text style={{ fontSize: 11, color: theme.colors.accent, fontWeight: 'bold' }}>Far (1.2km)</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.simPresetBtn, { backgroundColor: theme.colors.accent }]} onPress={() => handleProximityChange(480)}>
                  <Text style={{ fontSize: 11, color: '#FFFFFF', fontWeight: 'bold' }}>Geofence (480m)</Text>
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
      <Modal visible={isVerificationOpen} animationType="fade" transparent={true}>
        <View style={styles.overlayModalBg}>
          <View style={[styles.passengerVerifyModalCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
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
          </View>
        </View>
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
    height: height * 0.46,
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
});
