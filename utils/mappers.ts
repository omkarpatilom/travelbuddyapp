import { userService } from '../services/user.service';
import { vehicleService } from '../services/vehicle.service';
import { rideService } from '../services/ride.service';
import { RideDto, BookingResponseDto, ConversationLevel, RideSearchDto, RidePhase } from './types';

export interface Ride {
  id: string;
  driverId: string;
  driverName: string;
  driverRating: number;
  driverAvatar?: string;
  from: {
    address: string;
    coordinates: { latitude: number; longitude: number };
  };
  to: {
    address: string;
    coordinates: { latitude: number; longitude: number };
  };
  date: string;
  time: string;
  price: number;
  availableSeats: number;
  totalSeats: number;
  carModel: string;
  carColor: string;
  carPlate?: string;
  vehicleCategory: string;
  isDriverVerified: boolean;
  isVehicleVerified: boolean;
  features: string[];
  status: 'draft' | 'published' | 'scheduled' | 'ridestarted' | 'arrivedatpickup' | 'boarding' | 'intransit' | 'arrivedatdrop' | 'dropoff' | 'completed' | 'cancelled';
  distance: string;
  duration: string;
  pickupDistanceMeters?: number;
  dropoffDistanceMeters?: number;
  polyline?: string;
  currentPhase?: string;
  currentPassengerId?: string | null;
  stops?: any[];
  preferences: {
    nonSmoking: boolean;
    musicAllowed: boolean;
    petsAllowed: boolean;
    airConditioning: boolean;
    conversationLevel: 'quiet' | 'moderate' | 'chatty';
  };
}

export interface Booking {
  id: string;
  rideId: string;
  userId: string;
  ride: Ride;
  seats: number;
  totalPrice: number;
  status: 'pending' | 'confirmed' | 'rejected' | 'cancelled' | 'readyforboarding' | 'boarded' | 'inride' | 'readyfordrop' | 'completed' | 'noshow';
  bookingDate: string;
  passengerName: string;
  passengerPhone: string;
  specialRequest?: string;
}

const driverCache: Record<string, any> = {};
const vehicleCache: Record<string, any> = {};
const featureCache: Record<string, any> = {};

export const mapRideData = async (ride: RideDto | RideSearchDto): Promise<Ride> => {
  let driverName = 'Driver';
  let driverRating = 4.5;
  let driverAvatar = undefined;
  let isDriverVerified = false;

  try {
    if (!driverCache[ride.driverId]) {
      driverCache[ride.driverId] = await userService.getById(ride.driverId);
    }
    const driverProfile = driverCache[ride.driverId];
    driverName = driverProfile.fullName;
    driverRating = driverProfile.rating;
    driverAvatar = driverProfile.profilePictureUrl || undefined;
    isDriverVerified = driverProfile.isVerified || false;
  } catch (e) {
    console.warn(`Could not fetch driver profile for ${ride.driverId}`);
  }

  let carModel = 'Vehicle';
  let carColor = 'Silver';
  let carPlate = undefined;
  let vehicleCategory = 'Car';
  let isVehicleVerified = false;
  let features: string[] = [];

  try {
    if (ride.vehicleId) {
      if (!vehicleCache[ride.vehicleId]) {
        vehicleCache[ride.vehicleId] = await vehicleService.getById(ride.vehicleId);
      }
      const vehicle = vehicleCache[ride.vehicleId];
      let brand = vehicle.brand || '';
      if (brand.includes(':')) {
        const parts = brand.split(':');
        vehicleCategory = parts[0];
        brand = parts[1];
      }
      carModel = `${brand} ${vehicle.model}`;
      carColor = vehicle.color;
      carPlate = vehicle.registrationNumber ?? undefined;
      isVehicleVerified = vehicle.status?.toLowerCase() === 'active';

      if (!featureCache[ride.vehicleId]) {
        featureCache[ride.vehicleId] = await vehicleService.getFeatures(ride.vehicleId);
      }
      features = featureCache[ride.vehicleId].map((f: any) => f.featureCode);
    }
  } catch (e) {
    console.warn(`Could not fetch vehicle details/features for ${ride.vehicleId}`);
  }

  // Backend serializes enum as string name (e.g. "Published", "RideStarted") due to JsonStringEnumConverter
  // Map both numeric and string variants (case-insensitive via toLowerCase)
  const statusMap: Record<string, string> = {
    // Numeric enum values
    '0': 'draft',
    '1': 'published',
    '2': 'scheduled',
    '3': 'ridestarted',
    '4': 'arrivedatpickup',
    '5': 'boarding',
    '6': 'intransit',
    '7': 'arrivedatdrop',
    '8': 'dropoff',
    '9': 'completed',
    '10': 'cancelled',
    // String enum name variants (from JsonStringEnumConverter)
    'draft': 'draft',
    'published': 'published',
    'scheduled': 'scheduled',
    'ridestarted': 'ridestarted',
    'arrivedatpickup': 'arrivedatpickup',
    'boarding': 'boarding',
    'intransit': 'intransit',
    'arrivedatdrop': 'arrivedatdrop',
    'dropoff': 'dropoff',
    'completed': 'completed',
    'cancelled': 'cancelled',
  };

  const convMap: Record<ConversationLevel | string, any> = {
    [ConversationLevel.Quiet]: 'quiet',
    [ConversationLevel.Moderate]: 'moderate',
    [ConversationLevel.Chatty]: 'chatty',
    'Quiet': 'quiet',
    'Moderate': 'moderate',
    'Chatty': 'chatty',
    'quiet': 'quiet',
    'moderate': 'moderate',
    'chatty': 'chatty',
  };

  const searchData = ride as RideSearchDto;

  let distanceStr = 'Unknown';
  let durationStr = 'Unknown';

  try {
    if (ride.distanceKm && ride.distanceKm > 0) {
      distanceStr = `${ride.distanceKm.toFixed(1)} km`;
      const totalMinutes = Math.round(ride.durationMinutes || 0);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      if (hours > 0) {
        durationStr = `${hours}h ${minutes}m`;
      } else {
        durationStr = `${minutes} mins`;
      }
    } else {
      const startLat = ride.from.latitude;
      const startLon = ride.from.longitude;
      const endLat = ride.to.latitude;
      const endLon = ride.to.longitude;

      if (startLat && startLon && endLat && endLon) {
        const R = 6371; // km
        const dLat = (endLat - startLat) * Math.PI / 180;
        const dLon = (endLon - startLon) * Math.PI / 180;
        const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(startLat * Math.PI / 180) * Math.cos(endLat * Math.PI / 180) * 
          Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const straightDistance = R * c;
        const estimatedDistance = straightDistance * 1.3;
        distanceStr = `${estimatedDistance.toFixed(1)} km`;

        const estimatedHours = estimatedDistance / 45;
        const totalMinutes = Math.round(estimatedHours * 60);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        if (hours > 0) {
          durationStr = `${hours}h ${minutes}m`;
        } else {
          durationStr = `${minutes} mins`;
        }
      }
    }
  } catch (err) {
    console.error('Distance and duration estimation failed:', err);
  }

  return {
    id: ride.id,
    driverId: ride.driverId,
    driverName,
    driverRating,
    driverAvatar,
    from: {
      address: ride.from.address,
      coordinates: { latitude: ride.from.latitude, longitude: ride.from.longitude }
    },
    to: {
      address: ride.to.address,
      coordinates: { latitude: ride.to.latitude, longitude: ride.to.longitude }
    },
    date: ride.departureTime.split('T')[0],
    time: ride.departureTime.split('T')[1].substring(0, 5),
    price: ride.pricePerSeat,
    availableSeats: ride.availableSeats,
    totalSeats: ride.totalSeats,
    carModel, 
    carColor,
    carPlate,
    vehicleCategory,
    isDriverVerified,
    isVehicleVerified,
    features,
    status: (statusMap[(ride.status as any)?.toString()?.toLowerCase()] ||
             statusMap[(ride.status as any)?.toString()] ||
             'published') as any,
    distance: distanceStr,
    duration: durationStr,
    pickupDistanceMeters: searchData.pickupDistanceMeters,
    dropoffDistanceMeters: searchData.dropoffDistanceMeters,
    polyline: searchData.polyline,
    currentPhase: ride.currentPhase !== undefined && ride.currentPhase !== null ? RidePhase[ride.currentPhase] : undefined,
    currentPassengerId: ride.currentPassengerId,
    stops: ride.stops,
    preferences: {
      nonSmoking: ride.preference ? !ride.preference.allowSmoking : true,
      musicAllowed: ride.preference ? ride.preference.allowMusic : true,
      petsAllowed: ride.preference ? ride.preference.allowPets : false,
      airConditioning: features.includes('ac'),
      conversationLevel: (ride.preference && convMap[ride.preference.conversationLevel]) || 'moderate',
    },
  };
};

export const mapBookingData = async (booking: BookingResponseDto): Promise<Booking> => {
  let ride: Ride | null = null;
  try {
    const rideData = await rideService.getRideById(booking.rideId);
    ride = await mapRideData(rideData);
  } catch (e) {
    console.error('Error fetching ride for booking:', e);
  }

  // Preserve the backend booking status string exactly (already lowercase from backend JsonStringEnumConverter)
  // Backend BookingStatus: Pending, Confirmed, Rejected, Cancelled, ReadyForBoarding, Boarded, InRide, ReadyForDrop, Completed, NoShow
  const rawStatus = (booking.status || '').toLowerCase();
  // Normalize to consistent lowercase
  const bookingStatusMap: Record<string, string> = {
    // Numeric
    '0': 'pending',
    '1': 'confirmed',
    '2': 'rejected',
    '3': 'cancelled',
    '4': 'readyforboarding',
    '5': 'boarded',
    '6': 'inride',
    '7': 'readyfordrop',
    '8': 'completed',
    '9': 'noshow',
    // String variants
    'pending': 'pending',
    'confirmed': 'confirmed',
    'rejected': 'rejected',
    'cancelled': 'cancelled',
    'readyforboarding': 'readyforboarding',
    'boarded': 'boarded',
    'inride': 'inride',
    'readyfordrop': 'readyfordrop',
    'completed': 'completed',
    'noshow': 'noshow',
    // Legacy/alias
    'requested': 'pending',
    'accepted': 'confirmed',
    'expired': 'cancelled',
  };
  const mappedStatus = bookingStatusMap[rawStatus] || rawStatus;
  console.log(`[DEBUG] mapBookingData: raw status='${booking.status}' → mapped='${mappedStatus}'`);

  return {
    id: booking.bookingId,
    rideId: booking.rideId,
    userId: booking.userId,
    ride: ride!,
    seats: booking.seats,
    totalPrice: booking.totalPrice,
    status: mappedStatus as any,
    bookingDate: booking.bookingDate,
    passengerName: booking.passengerName,
    passengerPhone: booking.passengerPhone,
    specialRequest: booking.specialRequest ?? undefined,
  };
};
