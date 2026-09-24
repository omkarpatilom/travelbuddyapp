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
import { useRides } from '@/contexts/RideContext';
import { Ride, Booking } from '@/utils/mappers';
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
import {
  RIDE_STATUS,
  BOOKING_STATUS,
  ACTIVE_RIDE_STATUSES,
  isRideActive,
  isRidePreStart,
  isRideTerminal,
  getBookingDisplayLabel,
  RIDE_STATUS_LABEL,
  reconcileBookingStatus,
} from '@/utils/rideStatus';
import { rememberConfirmedBookingStatus, getRememberedBookingStatus } from '@/utils/bookingStatusMemory';

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

// Helper: check if a string is a valid UUID (backend stop IDs are UUIDs; UI-generated fake IDs are not)
const isValidUUID = (id: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

// react-native-web's Alert.alert() is a documented no-op (it renders nothing
// and never calls any button's onPress), which silently broke every
// confirm-gated action on web -- most critically, a driver could never
// accept a pending booking on web at all, since that action only ran inside
// an Alert.alert button callback. window.confirm()/window.alert() are the
// standard cross-platform substitutes; native keeps the real Alert.alert.
const confirmAction = (title: string, message: string, confirmLabel: string = 'OK'): Promise<boolean> => {
  if (Platform.OS === 'web') {
    return Promise.resolve(typeof window !== 'undefined' ? window.confirm(`${title}\n\n${message}`) : true);
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, onPress: () => resolve(true) },
    ]);
  });
};

const notify = (title: string, message: string): void => {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
};

// Active ride statuses are imported from rideStatus.ts (ACTIVE_RIDE_STATUSES)

export default function JourneyCommandCenterScreen() {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const {
    getRideById,
    startRide,
    arriveAtPickup,
    arriveAtDrop,
    completeDropoff,
    completeRide,
    verifyBooking,
    completeStop,
    confirmBooking,
    completeBooking,
    cancelRide,
    updateTracking,
    overrideTransition,
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
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [modalMode, setModalMode] = useState<'boarding' | 'dropoff'>('boarding');

  // Incident state
  const [incidentType, setIncidentType] = useState('Vehicle Issue');
  const [incidentDesc, setIncidentDesc] = useState('');
  const [auditLogs, setAuditLogs] = useState<string[]>([]);

  // Watch position reference
  const locationSubscriptionRef = useRef<any>(null);
  // Guards against firing a new tracking POST while a previous one (which can
  // take several seconds when it also triggers a geofence transition) is
  // still in flight - overlapping requests were colliding on the ride row.
  const trackingInFlightRef = useRef(false);
  // Monotonic counter: each loadData() call claims the next value before its
  // awaits, and only commits state if it's still the most-recently-claimed
  // call by the time its network responses land. Prevents an older, slower
  // loadData() response (e.g. a 5s poll tick already in flight) from
  // overwriting state with stale data after a newer call - or an optimistic
  // update - has already set fresher state.
  const loadDataSeqRef = useRef(0);
  // Mirrors `bookings` state for synchronous reads inside loadData(), which
  // can run from a setInterval closure captured on an earlier render (React
  // state read via closure there can't be trusted to be fresh). Used to
  // reconcile a freshly-fetched status against what's already on screen, so
  // a racing re-fetch can't regress a booking's displayed status backwards
  // (e.g. Boarded reverting to Verify) — see reconcileBookingStatus.
  const bookingsRef = useRef<Booking[]>([]);

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

  useEffect(() => {
    bookingsRef.current = bookings;
  }, [bookings]);

  // Periodic polling for automated state transitions
  useEffect(() => {
    let interval: any = null;
    if (rideId && ride && ACTIVE_RIDE_STATUSES.includes(ride.status)) {
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
    let cancelled = false;

    const setupLiveTracking = async () => {
      if (!ride || !ACTIVE_RIDE_STATUSES.includes(ride.status)) {
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
        const subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 10000,
            distanceInterval: 10,
          },
          (location) => {
            const { latitude, longitude } = location.coords;
            setDriverLocation({ latitude, longitude });
            addLog(`📍 GPS coordinate shared: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);

            // Skip this ping rather than send it on top of a request that's
            // still in flight - that overlap was the actual cause of the
            // persistent "Confirm Drop-Off" 400s (concurrent writes to the
            // same ride row). The next ping picks up the latest position
            // anyway, so nothing meaningful is lost by skipping one.
            if (trackingInFlightRef.current) return;
            trackingInFlightRef.current = true;
            updateTracking(ride.id, latitude, longitude).finally(() => {
              trackingInFlightRef.current = false;
            });
          }
        );

        // This effect can re-run (new ride.status) before the async setup
        // above resolves - if a newer run already started, or this ride is
        // no longer active, discard the subscription we just created instead
        // of leaking it on top of whatever the newer run installed.
        if (cancelled || !ride || !ACTIVE_RIDE_STATUSES.includes(ride.status)) {
          subscription.remove();
          return;
        }

        locationSubscriptionRef.current = subscription;
      } catch (err) {
        console.error(err);
      }
    };

    setupLiveTracking();

    return () => {
      cancelled = true;
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
        locationSubscriptionRef.current = null;
      }
    };
  }, [ride?.status]);

  const loadData = async () => {
    const mySeq = ++loadDataSeqRef.current;
    console.log(`[DEBUG] CommandCenter loadData called with rideId: ${rideId}`);
    try {
      const rideData = await getRideById(rideId);
      console.log(`[DEBUG] CommandCenter fetched rideData:`, rideData);
      if (rideData) {
        if (mySeq !== loadDataSeqRef.current) return;
        setRide(rideData);

        const bookingsList = await bookingService.getRideBookings(rideId);
        const normalizedBookings = await Promise.all((bookingsList || []).map(async (b: any) => {
          const id = b.bookingId || b.id;
          const serverStatus = (b.status || '').toLowerCase();
          const priorMatch = bookingsRef.current.find((pb: any) => pb.id === id);
          // Reconcile against same-session state first, then against the
          // durable "this app just confirmed X" memory that survives a full
          // page refresh/relaunch (see utils/bookingStatusMemory.ts) — either
          // can be further along than a fresh-but-transiently-stale read.
          const remembered = await getRememberedBookingStatus(id);
          const status = reconcileBookingStatus(
            reconcileBookingStatus(serverStatus, priorMatch?.status),
            remembered
          );
          return { ...b, id, status };
        }));
        if (mySeq !== loadDataSeqRef.current) return;
        setBookings(normalizedBookings as any);

        const generatedStops = (rideData.stops && rideData.stops.length > 0)
          ? rideData.stops.map((s: any) => {
            const stopBookings = normalizedBookings.filter((b: any) =>
              (b.id || '').toLowerCase() === (s.bookingId || '').toLowerCase() ||
              ((b.bookingId || '') as string).toLowerCase() === (s.bookingId || '').toLowerCase()
            );

            // Handle both integer (0) and string ("Pickup" / "pickup") enum serializations
            const isPickup = s.type === 0 ||
              s.type === 'Pickup' ||
              (typeof s.type === 'string' && s.type.toLowerCase() === 'pickup');
            const stopType = isPickup ? 'pickup' : 'drop';

            // Handle both integer (3 = Completed, 1 = Navigating, 2 = Arrived) and string enums
            const isCompleted = s.status === 3 ||
              s.status === 'Completed' ||
              (typeof s.status === 'string' && s.status.toLowerCase() === 'completed');
            const isCurrent = s.status === 1 || s.status === 2 ||
              s.status === 'Navigating' || s.status === 'Arrived' ||
              (typeof s.status === 'string' &&
                (s.status.toLowerCase() === 'navigating' || s.status.toLowerCase() === 'arrived'));
            const stopStatus = isCompleted ? 'completed' : (isCurrent ? 'current' : 'pending');

            return {
              id: s.id,
              name: s.stopName,
              type: stopType as 'pickup' | 'drop',
              address: s.address,
              coordinates: { latitude: s.latitude, longitude: s.longitude },
              passengerCount: stopBookings.length,
              seatsCount: stopBookings.reduce((sum, b) => sum + b.seats, 0),
              bookings: stopBookings,
              status: stopStatus as 'completed' | 'current' | 'pending',
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
        status: ACTIVE_RIDE_STATUSES.includes(rideObj.status) ? 'current' : 'pending',
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
        status: ACTIVE_RIDE_STATUSES.includes(rideObj.status) ? 'current' : 'pending',
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


  const handleCompleteDropoff = async () => {
    if (!ride) return;
    setIsActionLoading(true);
    try {
      const ok = await completeDropoff(ride.id);
      if (ok) {
        addLog('⚡ Manual Override: Drop-off phase initiated!');
        await loadData();
      } else {
        Alert.alert('Error', 'Failed to begin drop-off.');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleArriveAtPickupOverride = () => {
    if (!ride) return;

    const performOverride = async (reason: string) => {
      setIsActionLoading(true);
      try {
        const ok = await overrideTransition(ride.id, 4, reason);
        if (ok) {
          addLog(`⚡ Manual Override: Driver arrived at pickup. Reason: ${reason}`);
          await loadData();
        } else {
          Alert.alert('Error', 'Failed to trigger arrival at pickup override.');
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsActionLoading(false);
      }
    };

    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Manual Arrive Override',
        'Enter reason for overriding GPS pickup arrival:',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Submit', onPress: (text?: string) => performOverride(text || 'Manual override by driver') }
        ],
        'plain-text'
      );
    } else {
      Alert.alert(
        'Manual Arrive Override',
        'Select or enter reason for overriding GPS pickup arrival:',
        [
          { text: 'GPS Blocker/Tunnel', onPress: () => performOverride('GPS signals blocked/delayed') },
          { text: 'Road detour', onPress: () => performOverride('Road closure detour') },
          { text: 'Other reason', onPress: () => performOverride('Manual driver bypass requested') },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    }
  };

  const handleArriveAtDropOverride = () => {
    if (!ride) return;

    const performOverride = async (reason: string) => {
      setIsActionLoading(true);
      try {
        const ok = await overrideTransition(ride.id, 7, reason);
        if (ok) {
          addLog(`⚡ Manual Override: Driver arrived at drop-off. Reason: ${reason}`);
          await loadData();
        } else {
          Alert.alert('Error', 'Failed to trigger arrival at drop-off override.');
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsActionLoading(false);
      }
    };

    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Manual Arrive Override',
        'Enter reason for overriding GPS drop-off arrival:',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Submit', onPress: (text?: string) => performOverride(text || 'Manual override by driver') }
        ],
        'plain-text'
      );
    } else {
      Alert.alert(
        'Manual Arrive Override',
        'Select or enter reason for overriding GPS drop-off arrival:',
        [
          { text: 'GPS Blocker/Tunnel', onPress: () => performOverride('GPS signals blocked/delayed') },
          { text: 'Road detour', onPress: () => performOverride('Road closure detour') },
          { text: 'Other reason', onPress: () => performOverride('Manual driver bypass requested') },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    }
  };

  const simulateLocationUpdate = async (type: 'far' | 'arrived', targetStop?: Stop) => {
    if (!ride) return;
    // Prefer the explicit stop the caller is looking at (e.g. the pickup stop
    // shown on screen during JourneyStarted, or the drop stop during InTransit)
    // over `currentStopIndex`, which is just "first non-completed stop" and can
    // point at a different passenger's stop on multi-passenger rides.
    const activeStop = targetStop ?? stops[currentStopIndex];
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

  const handleVerifyPassenger = async (method: 'otp' | 'qr', scannedToken?: string) => {
    const passengerToVerify = selectedPassenger || bookings.find(
      b => (b.id || '').toLowerCase() === (ride?.currentPassengerId || '').toLowerCase() ||
        ((b as any).bookingId || '').toLowerCase() === (ride?.currentPassengerId || '').toLowerCase()
    );
    if (!passengerToVerify || !ride) {
      notify('Verification Error', 'No passenger selected for verification.');
      return false;
    }

    if (method === 'otp' && (!otpValue || otpValue.length < 4)) {
      notify('Validation Error', 'Please enter a valid 4-digit OTP code.');
      return false;
    }

    if (method === 'qr' && !scannedToken) {
      notify('Scan Error', 'No QR code was detected. Please try again.');
      return false;
    }

    setIsActionLoading(true);

    let success = false;
    try {
      if (method === 'otp') {
        success = await verifyBooking(passengerToVerify.id, {
          verificationType: 'OTP',
          otp: otpValue
        });
      } else if (method === 'qr') {
        success = await verifyBooking(passengerToVerify.id, {
          verificationType: 'QR',
          qrToken: scannedToken
        });
      }

      if (success) {
        // Invalidate any older loadData() call still in flight (e.g. a 5s poll
        // tick that started before this verification completed) so its stale
        // response can't land after this optimistic update and revert it.
        loadDataSeqRef.current += 1;

        // Durable record that this app confirmed the verification, so a full
        // page refresh/relaunch right after can't lose this to a transiently
        // stale re-fetch (see utils/bookingStatusMemory.ts).
        await rememberConfirmedBookingStatus(passengerToVerify.id, BOOKING_STATUS.BOARDED);

        // Update local booking status to 'boarded' for immediate UI feedback
        setBookings(prev => prev.map(b =>
          b.id === passengerToVerify.id
            ? { ...b, status: BOOKING_STATUS.BOARDED as any }
            : b
        ));
        setStops(prev => prev.map(stop => ({
          ...stop,
          bookings: stop.bookings.map(b =>
            b.id === passengerToVerify.id ? { ...b, status: BOOKING_STATUS.BOARDED as any } : b
          )
        })));
        setSelectedPassenger(prev => prev ? { ...prev, status: BOOKING_STATUS.BOARDED as any } : prev);

        addLog(`✓ Passenger verified: ${passengerToVerify.passengerName}`);

        // Show success feedback
        setVerificationSuccess(true);
        setIsActionLoading(false);

        // Wait 1.5 seconds for feedback, then close modal
        await new Promise(resolve => setTimeout(resolve, 1500));

        setIsVerificationOpen(false);
        setQrScannerActive(false);
        setScanned(false);
        setSelectedPassenger(null);
        setOtpValue('');
        setVerificationSuccess(false);
        await loadData();
      } else {
        setIsActionLoading(false);
        notify('Verification Failed', 'Invalid verification code or QR token. Please try again.');
      }
    } catch (e) {
      setIsActionLoading(false);
      console.error(e);
      notify('Error', 'An error occurred during verification.');
    }

    return success;
  };

  const handleDropConfirm = async () => {
    if (!ride) return false;
    const passenger = selectedPassenger || currentPassengerBooking;
    if (!passenger) {
      notify('Error', 'No passenger selected for drop-off.');
      return false;
    }

    setIsActionLoading(true);
    try {
      if (isValidUUID(passenger.id)) {
        // A booking can only be completed from ReadyForDrop. That transition normally
        // happens when the destination geofence fires, but GPS lag or an early drop
        // leaves the passenger Boarded, so move them to the drop point explicitly first.
        if ((passenger.status || '').toLowerCase() !== BOOKING_STATUS.READY_FOR_DROP) {
          try {
            await bookingService.reachDrop(passenger.id);
          } catch (e) {
            // Already past this step or not applicable; completion below reports real failures.
            console.warn('[DropConfirm] reach-drop skipped:', e);
          }
        }
        const ok = await completeBooking(passenger.id);
        if (ok) {
          loadDataSeqRef.current += 1;
          await rememberConfirmedBookingStatus(passenger.id, BOOKING_STATUS.COMPLETED);
          addLog(`✓ Drop-off completed for passenger: ${passenger.passengerName}`);
          await loadData();
          return true;
        }
        notify('Error', 'Failed to complete drop-off.');
        return false;
      } else {
        // UI-generated booking/stop — no backend call needed
        addLog(`✓ Drop-off completed locally (UI-only): ${passenger.passengerName}`);
        await loadData();
        return true;
      }
    } catch (e) {
      console.error('[DEBUG] handleDropConfirm error:', e);
      return false;
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDropOffFromModal = async () => {
    const ok = await handleDropConfirm();
    if (ok) {
      setIsVerificationOpen(false);
      setQrScannerActive(false);
      setScanned(false);
      setSelectedPassenger(null);
    }
  };

  const openVerificationModal = (passenger?: Booking, mode: 'boarding' | 'dropoff' = 'boarding') => {
    if (passenger) {
      setSelectedPassenger(passenger);
    } else if (currentPassengerBooking) {
      setSelectedPassenger(currentPassengerBooking);
    }

    setOtpValue('');
    setQrScannerActive(false);
    setScanned(false);
    setModalMode(mode);
    setVerificationSuccess(false);
    setIsVerificationOpen(true);
  };

  const startQrScanner = async (passenger?: Booking, mode: 'boarding' | 'dropoff' = 'boarding') => {
    openVerificationModal(passenger, mode);
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
    if (scanned) return;
    setScanned(true);
    addLog(`📷 Scanned barcode data: ${data}`);

    const success = await handleVerifyPassenger('qr', data);
    if (!success) {
      setQrScannerActive(false);
      setScanned(false);
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

  const currentPassengerBooking = bookings.find(
    b => (b.id || '').toLowerCase() === (ride?.currentPassengerId || '').toLowerCase()
  ) || (stops[currentStopIndex]?.bookings?.[0]) || null;

  const activeStop = stops[currentStopIndex];

  const renderHUDContent = () => {
    if (!ride) return null;

    const rideStatus = ride.status.toLowerCase();

    // ── Pre-start ────────────────────────────────────────────────────────────
    if (rideStatus === RIDE_STATUS.PUBLISHED || rideStatus === RIDE_STATUS.SCHEDULED) {
      return (
        <View style={styles.hudCardBody}>
          <Text style={styles.hudTitle}>Journey Not Started</Text>
          <Text style={styles.hudSubtitle}>
            {rideStatus === RIDE_STATUS.SCHEDULED
              ? 'Ride is scheduled. Return to Ride Details and tap "Start Journey" to begin.'
              : 'Accept bookings from Ride Details, then tap "Start Journey" to begin.'}
          </Text>
          <TouchableOpacity
            style={[styles.hudPrimaryBtn, { backgroundColor: '#4F46E5' }]}
            onPress={() => router.back()}
          >
            <ArrowLeft size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.hudBtnText}>Go to Ride Details</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // ── Completed ────────────────────────────────────────────────────────────
    if (rideStatus === RIDE_STATUS.COMPLETED) {
      return (
        <View style={styles.hudCardBody}>
          <Text style={styles.hudTitle}>Journey Finished ✓</Text>
          <Text style={styles.hudSubtitle}>All drop-offs completed. Thank you for riding with TravelBuddy!</Text>
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

    // ── Cancelled ────────────────────────────────────────────────────────────
    if (rideStatus === RIDE_STATUS.CANCELLED) {
      return (
        <View style={styles.hudCardBody}>
          <Text style={[styles.hudTitle, { color: '#EF4444' }]}>Ride Cancelled</Text>
          <Text style={styles.hudSubtitle}>This ride has been cancelled.</Text>
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

    // ── Active ride statuses ─────────────────────────────────────────────────
    switch (rideStatus) {

      // ── JourneyStarted: driver en route to pickup ─────────────────────────
      case RIDE_STATUS.JOURNEY_STARTED: {
        const pickupStop = stops.find(s => s.type === 'pickup') ?? stops[currentStopIndex];
        return (
          <View style={styles.hudCardBody}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.hudTitle}>En Route to Pickup</Text>
                <Text style={styles.hudAddress} numberOfLines={1}>
                  {pickupStop ? pickupStop.name : ride.from.address}
                </Text>
                <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }} numberOfLines={1}>
                  {pickupStop?.address ?? ride.from.address}
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
            <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 6 }}>
              GPS will auto-detect arrival at pickup. Use manual override if GPS fails.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              {__DEV__ && (
                <TouchableOpacity
                  style={[styles.hudSecondaryBtn, { flex: 1 }]}
                  onPress={() => simulateLocationUpdate('arrived', pickupStop)}
                >
                  <Compass size={14} color="#94A3B8" style={{ marginRight: 6 }} />
                  <Text style={[styles.hudBtnTextSecondary, { color: '#FFFFFF' }]}>Simulate Arrived (Dev)</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.hudSecondaryBtn, { flex: 1, backgroundColor: '#F59E0B' }]}
                onPress={handleArriveAtPickupOverride}
              >
                <MapPin size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={[styles.hudBtnTextSecondary, { color: '#FFFFFF' }]}>Manual Override</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      }

      // ── ArrivedAtPickup / Boarding: status only. Both the Arrived→Boarding
      // and Boarding→EnRoute transitions are automatic once the geofence
      // fires / all confirmed passengers are verified. The driver's one
      // action here — Verify OTP/QR — lives in the passenger queue below,
      // not duplicated here (this card is status/info only, not a second
      // action surface).
      case RIDE_STATUS.ARRIVED_AT_PICKUP:
      case RIDE_STATUS.BOARDING: {
        const pendingBoarding = bookings.filter(b =>
          [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.READY_FOR_BOARDING].includes(b.status.toLowerCase() as any)
        );
        const alreadyBoarded = bookings.filter(b =>
          [BOOKING_STATUS.BOARDED, BOOKING_STATUS.READY_FOR_DROP, BOOKING_STATUS.COMPLETED].includes(b.status.toLowerCase() as any)
        );
        const totalPassengers = bookings.filter(b => b.status.toLowerCase() !== BOOKING_STATUS.CANCELLED && b.status.toLowerCase() !== BOOKING_STATUS.REJECTED);

        return (
          <View style={styles.hudCardBody}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <Users size={18} color="#4F46E5" style={{ marginRight: 8 }} />
              <Text style={styles.hudTitle}>Passenger Boarding</Text>
            </View>
            <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }} numberOfLines={1}>
              {activeStop?.address ?? ride.from.address}
            </Text>
            <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 4, marginBottom: 8 }}>
              {alreadyBoarded.length}/{totalPassengers.length} boarded
              {pendingBoarding.length > 0 ? ` · ${pendingBoarding.length} pending` : ' · All boarded!'}
            </Text>

            {pendingBoarding.length > 0 ? (
              <Text style={styles.hudSubtitle}>
                Verify each passenger's OTP/QR in the passenger list below.
              </Text>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <CheckCircle size={16} color="#10B981" style={{ marginRight: 6 }} />
                <Text style={{ color: '#10B981', fontWeight: 'bold' }}>All passengers verified!</Text>
              </View>
            )}

            <Text style={{ fontSize: 9, color: '#64748B', marginTop: 4, textAlign: 'center' }}>
              {pendingBoarding.length > 0
                ? 'Ride departs automatically once every passenger is verified. Unverified passengers are marked No Show on departure.'
                : 'All passengers verified — departing automatically.'}
            </Text>
          </View>
        );
      }

      // ── InTransit: en route to destination ───────────────────────────────
      case RIDE_STATUS.IN_TRANSIT: {
        const dropStop = stops.find(s => s.type === 'drop') ?? stops[stops.length - 1];
        return (
          <View style={styles.hudCardBody}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.hudTitle}>En Route to Destination</Text>
                <Text style={styles.hudAddress} numberOfLines={1}>
                  {dropStop ? dropStop.name : ride.to.address}
                </Text>
                <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }} numberOfLines={1}>
                  {dropStop?.address ?? ride.to.address}
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
            <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 6 }}>
              GPS will auto-detect arrival at destination. Use manual override if GPS fails.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              {__DEV__ && (
                <TouchableOpacity
                  style={[styles.hudSecondaryBtn, { flex: 1 }]}
                  onPress={() => simulateLocationUpdate('arrived', dropStop)}
                >
                  <Compass size={14} color="#94A3B8" style={{ marginRight: 6 }} />
                  <Text style={[styles.hudBtnTextSecondary, { color: '#FFFFFF' }]}>Simulate Arrived (Dev)</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.hudSecondaryBtn, { flex: 1, backgroundColor: '#F59E0B' }]}
                onPress={handleArriveAtDropOverride}
              >
                <Compass size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={[styles.hudBtnTextSecondary, { color: '#FFFFFF' }]}>Manual Override</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      }

      // ── ArrivedAtDestination: driver at destination, tap Begin Drop-Off ───
      case RIDE_STATUS.ARRIVED_AT_DESTINATION: {
        const readyForDrop = bookings.filter(b =>
          b.status.toLowerCase() === BOOKING_STATUS.READY_FOR_DROP
        );
        return (
          <View style={styles.hudCardBody}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <CheckCircle size={18} color="#10B981" style={{ marginRight: 8 }} />
              <Text style={[styles.hudTitle, { color: '#10B981' }]}>Arrived at Destination ✓</Text>
            </View>
            <Text style={styles.hudAddress} numberOfLines={1}>{ride.to.address}</Text>
            <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 1, marginBottom: 8 }}>
              {readyForDrop.length} passenger(s) ready for drop-off verification.
            </Text>
            <Text style={styles.hudSubtitle}>
              Tap "Begin Drop-Off" to start passenger drop-off verification.
            </Text>
            {/* Primary action: Begin Drop-Off (driver manual action §4) */}
            <TouchableOpacity
              style={[styles.hudPrimaryBtn, { marginTop: 10, backgroundColor: '#4F46E5' }]}
              onPress={handleCompleteDropoff}
              disabled={isActionLoading}
            >
              <CheckCircle size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.hudBtnText}>Begin Drop-Off</Text>
            </TouchableOpacity>
          </View>
        );
      }

      // ── DropOff: verify each ReadyForDrop passenger ───────────────────────
      // ── DropOff: status only, same reasoning as the boarding card above —
      // "Confirm" for each passenger lives in the passenger queue below,
      // not duplicated here.
      case RIDE_STATUS.DROP_OFF: {
        const pendingDrop = bookings.filter(b =>
          b.status.toLowerCase() === BOOKING_STATUS.READY_FOR_DROP
        );
        const completedDrop = bookings.filter(b =>
          b.status.toLowerCase() === BOOKING_STATUS.COMPLETED
        );
        const totalActive = bookings.filter(b =>
          ![BOOKING_STATUS.CANCELLED, BOOKING_STATUS.REJECTED, BOOKING_STATUS.NO_SHOW].includes(b.status.toLowerCase() as any)
        );

        return (
          <View style={styles.hudCardBody}>
            <Text style={styles.hudTitle}>Passenger Drop-Off</Text>
            <Text style={{ fontSize: 11, color: '#94A3B8', marginBottom: 8 }}>
              {completedDrop.length}/{totalActive.length} dropped off
              {pendingDrop.length > 0 ? ` · ${pendingDrop.length} remaining` : ' · All done!'}
            </Text>

            {pendingDrop.length > 0 ? (
              <Text style={styles.hudSubtitle}>
                Confirm each passenger's drop-off in the passenger list below.
              </Text>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#0F2A1A', borderRadius: 8 }}>
                <CheckCircle size={20} color="#10B981" style={{ marginRight: 8 }} />
                <Text style={{ color: '#10B981', fontWeight: 'bold' }}>All passengers dropped off! Ride will complete automatically.</Text>
              </View>
            )}

            {/* Already completed summary */}
            {completedDrop.length > 0 && pendingDrop.length > 0 && (
              <Text style={{ fontSize: 10, color: '#64748B', marginTop: 8 }}>
                ✓ Completed: {completedDrop.map(b => b.passengerName.split(' ')[0]).join(', ')}
              </Text>
            )}
          </View>
        );
      }

      default:
        return (
          <View style={styles.hudCardBody}>
            <Text style={styles.hudTitle}>Ride In Progress</Text>
            <Text style={styles.hudSubtitle}>Please focus on road safety.</Text>
          </View>
        );
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
              {ride.status.toUpperCase()}
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
                        const isPending = booking.status === 'pending';
                        const boardedStatus = (booking.status as string).toLowerCase();
                        const boarded = ['boarded', 'readyfordrop', 'completed'].includes(boardedStatus);
                        const dropped = ['completed'].includes(boardedStatus);
                        const initials = booking.passengerName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

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
                                {boarded && (
                                  <View style={{ backgroundColor: '#10B98120', paddingVertical: 1.5, paddingHorizontal: 6, borderRadius: 4 }}>
                                    <Text style={{ fontSize: 8, color: '#10B981', fontWeight: '900', letterSpacing: 0.2 }}>BOARDED</Text>
                                  </View>
                                )}
                                {dropped && (
                                  <View style={{ backgroundColor: '#3B82F620', paddingVertical: 1.5, paddingHorizontal: 6, borderRadius: 4 }}>
                                    <Text style={{ fontSize: 8, color: '#3B82F6', fontWeight: '900', letterSpacing: 0.2 }}>DROPPED</Text>
                                  </View>
                                )}
                              </View>
                            </View>

                            {/* Actions */}
                            {(booking.status !== 'pending') && (
                              <View style={styles.quickContactRow}>
                                <TouchableOpacity
                                  style={[styles.contactIconBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
                                  onPress={() => Linking.openURL(`tel:${booking.passengerPhone}`).catch(() => Alert.alert('Error', 'Cannot dial number.'))}
                                >
                                  <Phone size={12} color={theme.colors.textSecondary} />
                                </TouchableOpacity>
                              </View>
                            )}

                            {/* Action Button
                                Per the booking lifecycle (docs/Tasks/Ride And
                                Booking Life cycle.md §8, §20), a booking can
                                only reach ReadyForDrop/Completed after it has
                                been Boarded — Confirm (drop-off) must stay
                                disabled for a passenger who was never
                                verified at pickup, not just for one already
                                dropped. */}
                            {(() => {
                              const isActionAllowed = isPending
                                || (stop.type === 'pickup' && !boarded)
                                || (stop.type === 'drop' && boarded && !dropped);
                              const actionLabel = isPending
                                ? 'Accept'
                                : stop.type === 'pickup'
                                  ? (boarded ? 'Boarded ✓' : 'Verify')
                                  : dropped
                                    ? 'Dropped ✓'
                                    : boarded
                                      ? 'Confirm'
                                      : 'Not Boarded';

                              return (
                                <TouchableOpacity
                                  style={[
                                    styles.boardingStatusBtn,
                                    {
                                      backgroundColor: isPending ? '#F59E0B' : (boarded || dropped) ? '#10B98115' : '#4F46E5',
                                      borderColor: (boarded || dropped) ? '#10B981' : 'transparent',
                                      borderWidth: 1,
                                      opacity: isActionAllowed ? 1 : 0.5,
                                    }
                                  ]}
                                  onPress={async () => {
                                    if (!isActionAllowed) return;

                                    if (isPending) {
                                      const confirmed = await confirmAction(
                                        'Accept Booking Request',
                                        `Are you sure you want to accept and confirm the booking request from ${booking.passengerName}?`,
                                        'Accept & Confirm'
                                      );
                                      if (!confirmed) return;

                                      setIsActionLoading(true);
                                      const ok = await confirmBooking(booking.id);
                                      setIsActionLoading(false);
                                      if (ok) {
                                        loadDataSeqRef.current += 1;
                                        await rememberConfirmedBookingStatus(booking.id, BOOKING_STATUS.CONFIRMED);
                                        addLog(`✓ Accepted and confirmed booking: ${booking.passengerName}`);
                                        await loadData();
                                      } else {
                                        notify('Error', 'Failed to accept booking.');
                                      }
                                    } else if (stop.type === 'pickup') {
                                      if (!boarded) {
                                        openVerificationModal(booking, 'boarding');
                                      }
                                    } else {
                                      if (boarded && !dropped) {
                                        openVerificationModal(booking, 'dropoff');
                                      }
                                    }
                                  }}
                                  disabled={!isActionAllowed}
                                >
                                  <Text
                                    style={[
                                      styles.boardingStatusBtnText,
                                      { color: isPending ? '#FFFFFF' : (boarded || dropped) ? '#10B981' : '#FFFFFF', fontWeight: 'bold' }
                                    ]}
                                  >
                                    {actionLabel}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })()}
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
                {(() => {
                  const passenger = selectedPassenger || currentPassengerBooking;
                  return (
                    <View style={styles.pVerifyHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.pVerifyNameText, { color: theme.colors.text }]}>
                          {passenger ? passenger.passengerName : modalMode === 'dropoff' ? 'Confirm Drop-off' : 'Verify Boarding'}
                        </Text>
                        {passenger && (
                          <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                            Seats: {passenger.seats} | Phone: {passenger.passengerPhone}
                          </Text>
                        )}
                      </View>
                      <TouchableOpacity onPress={() => setIsVerificationOpen(false)} style={styles.modalCloseBtn}>
                        <Text style={{ fontSize: 24, color: theme.colors.textSecondary }}>×</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })()}

                {verificationSuccess ? (
                  <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 12 }}>
                    <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: theme.colors.success + '20', justifyContent: 'center', alignItems: 'center' }}>
                      <CheckCircle size={36} color={theme.colors.success} />
                    </View>
                    <Text style={[styles.pVerifyNameText, { color: theme.colors.success, fontSize: 18 }]}>Verification Successful!</Text>
                    <Text style={{ fontSize: 12, color: theme.colors.textSecondary, textAlign: 'center' }}>
                      {modalMode === 'dropoff' ? 'Drop-off confirmed successfully.' : `Passenger ${selectedPassenger?.passengerName} verified. Auto-completing stop...`}
                    </Text>
                  </View>
                ) : modalMode === 'dropoff' ? (
                  <View style={{ gap: 16, marginTop: 12 }}>
                    <Text style={[styles.formLabel, { color: theme.colors.text }]}>Drop Passenger</Text>
                    <Text style={{ color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18 }}>
                      Confirm drop-off manually for {selectedPassenger?.passengerName}. No OTP or QR scan is required for this drop stage.
                    </Text>
                    <TouchableOpacity
                      style={[styles.otpSubmitBtn, { backgroundColor: isActionLoading ? theme.colors.textSecondary : '#F59E0B' }]}
                      onPress={handleDropOffFromModal}
                      disabled={isActionLoading}
                    >
                      <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>
                        {isActionLoading ? '...' : 'Confirm Drop Off'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : !qrScannerActive ? (
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
                          editable={!isActionLoading}
                        />
                        <TouchableOpacity
                          style={[styles.otpSubmitBtn, { backgroundColor: isActionLoading ? theme.colors.textSecondary : theme.colors.primary }]}
                          onPress={() => handleVerifyPassenger('otp')}
                          disabled={isActionLoading}
                        >
                          <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>
                            {isActionLoading ? '...' : 'Verify'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />

                    <TouchableOpacity
                      style={[styles.verifyMethodBtn, { borderColor: theme.colors.border, opacity: isActionLoading ? 0.5 : 1 }]}
                      onPress={() => startQrScanner()}
                      disabled={isActionLoading}
                    >
                      <Camera size={16} color={theme.colors.text} style={{ marginRight: 8 }} />
                      <Text style={[styles.verifyMethodBtnText, { color: theme.colors.text }]}>Scan QR Passcode</Text>
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
                          style={StyleSheet.absoluteFill}
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
    ...StyleSheet.absoluteFill,
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
    ...StyleSheet.absoluteFill,
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
