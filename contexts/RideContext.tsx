import React, { createContext, useContext, useState, useEffect } from 'react';
import { rideService } from '@/services/ride.service';
import { bookingService } from '@/services/booking.service';
import { reviewService } from '@/services/review.service';
import { userService } from '@/services/user.service';
import { vehicleService } from '@/services/vehicle.service';
import { useAuth } from './AuthContext';
import { RideDto, BookingResponseDto, RideStatus, ConversationLevel, RideSearchDto } from '@/utils/types';

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
  status: 'active' | 'completed' | 'cancelled' | 'started' | 'scheduled' | 'draft' | 'published' | 'seatsbooked' | 'confirmed' | 'driverarrived' | 'boarding' | 'enroute' | 'dropcompleted';
  distance: string;
  duration: string;
  pickupDistanceMeters?: number;
  dropoffDistanceMeters?: number;
  polyline?: string;
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
  status: 'confirmed' | 'completed' | 'cancelled' | 'pending';
  bookingDate: string;
  passengerName: string;
  passengerPhone: string;
}

interface RideContextType {
  rides: Ride[];
  bookings: Booking[];
  myRides: Ride[];
  isLoading: boolean;
  searchRides: (
    params: {
        from: string;
        to: string;
        date: string;
        fromCoords?: { latitude: number; longitude: number };
        toCoords?: { latitude: number; longitude: number };
        seats?: number;
        maxPrice?: number;
        allowPets?: boolean;
        allowMusic?: boolean;
    }
  ) => Promise<Ride[]>;
  createRide: (rideData: any) => Promise<boolean>;
  updateRide: (rideId: string, rideData: Partial<Ride>) => Promise<boolean>;
  cancelRide: (rideId: string, reason: string) => Promise<boolean>;
  startRide: (rideId: string) => Promise<boolean>;
  arriveAtPickup: (rideId: string, lat?: number, lng?: number) => Promise<boolean>;
  startBoarding: (rideId: string) => Promise<boolean>;
  transitionEnRoute: (rideId: string) => Promise<boolean>;
  completeDropoff: (rideId: string) => Promise<boolean>;
  completeRide: (rideId: string) => Promise<boolean>;
  bookRide: (rideId: string, seats: number, passengerData: any) => Promise<boolean>;
  confirmBooking: (bookingId: string) => Promise<boolean>;
  completeBooking: (bookingId: string) => Promise<boolean>;
  cancelBooking: (bookingId: string, reason?: string) => Promise<boolean>;
  rateRide: (rideId: string, rating: number, review: string) => Promise<boolean>;
  updateTracking: (rideId: string, latitude: number, longitude: number) => Promise<void>;
  getTracking: (rideId: string) => Promise<any>;
  getUserRides: (userId: string) => Promise<Ride[]>;
  getUserBookings: (userId: string) => Promise<Booking[]>;
  getRideById: (rideId: string) => Promise<Ride | null>;
  getBookingById: (bookingId: string) => Promise<Booking | null>;
  loadInitialData: () => Promise<void>;
}

const RideContext = createContext<RideContextType | undefined>(undefined);

const driverCache: Record<string, any> = {};
const vehicleCache: Record<string, any> = {};
const featureCache: Record<string, any> = {};

export function RideProvider({ children }: { children: React.ReactNode }) {
  const [rides, setRides] = useState<Ride[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [myRides, setMyRides] = useState<Ride[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadInitialData();
    }
  }, [user]);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const activeRidesData = await rideService.getActiveRides();
      const mappedRides = await Promise.all(activeRidesData.map(mapRideData));
      setRides(mappedRides);

      const bookingsData = await bookingService.getMyBookings();
      const mappedBookings = await Promise.all(bookingsData.map(mapBookingData));
      setBookings(mappedBookings);

      if (user?.role === 'Driver' || user?.role === 'Admin') {
        const myRidesData = await rideService.getMyRides();
        const mappedMyRides = await Promise.all(myRidesData.map(mapRideData));
        setMyRides(mappedMyRides);
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const mapRideData = async (ride: RideDto | RideSearchDto): Promise<Ride> => {
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
        carPlate = vehicle.registrationNumber;
        isVehicleVerified = vehicle.status?.toLowerCase() === 'active';

        if (!featureCache[ride.vehicleId]) {
          featureCache[ride.vehicleId] = await vehicleService.getFeatures(ride.vehicleId);
        }
        features = featureCache[ride.vehicleId].map((f: any) => f.featureCode);
      }
    } catch (e) {
      console.warn(`Could not fetch vehicle details/features for ${ride.vehicleId}`);
    }

    const statusMap: Record<RideStatus | string, any> = {
      [RideStatus.Scheduled]: 'scheduled',
      [RideStatus.Active]: 'active',
      [RideStatus.Started]: 'started',
      [RideStatus.Completed]: 'completed',
      [RideStatus.Cancelled]: 'cancelled',
      [RideStatus.Draft]: 'draft',
      [RideStatus.Published]: 'published',
      [RideStatus.SeatsBooked]: 'seatsbooked',
      [RideStatus.Confirmed]: 'confirmed',
      [RideStatus.DriverArrived]: 'driverarrived',
      [RideStatus.Boarding]: 'boarding',
      [RideStatus.EnRoute]: 'enroute',
      [RideStatus.DropCompleted]: 'dropcompleted',
      // String serialization mapping
      'Scheduled': 'scheduled',
      'Active': 'active',
      'Started': 'started',
      'Completed': 'completed',
      'Cancelled': 'cancelled',
      'Draft': 'draft',
      'Published': 'published',
      'SeatsBooked': 'seatsbooked',
      'Confirmed': 'confirmed',
      'DriverArrived': 'driverarrived',
      'Boarding': 'boarding',
      'EnRoute': 'enroute',
      'DropCompleted': 'dropcompleted',
      'scheduled': 'scheduled',
      'active': 'active',
      'started': 'started',
      'completed': 'completed',
      'cancelled': 'cancelled',
      'draft': 'draft',
      'published': 'published',
      'seatsbooked': 'seatsbooked',
      'confirmed': 'confirmed',
      'driverarrived': 'driverarrived',
      'boarding': 'boarding',
      'enroute': 'enroute',
      'dropcompleted': 'dropcompleted',
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

    // Extract search specific fields if available
    const searchData = ride as RideSearchDto;

    // Fetch distance and duration from OSRM public API or estimate via math/geospatial fallbacks
    let distanceStr = 'Unknown';
    let durationStr = 'Unknown';

    try {
      const startLat = ride.from.latitude;
      const startLon = ride.from.longitude;
      const endLat = ride.to.latitude;
      const endLon = ride.to.longitude;

      if (startLat && startLon && endLat && endLon) {
        // Try calling OSRM router
        const response = await fetch(
          `http://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${endLon},${endLat}?overview=false`
        );
        if (response && response.ok) {
          const data = await response.json();
          if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            const distanceKm = route.distance / 1000;
            const durationSec = route.duration;

            distanceStr = `${distanceKm.toFixed(1)} km`;
            
            const hours = Math.floor(durationSec / 3600);
            const minutes = Math.floor((durationSec % 3600) / 60);
            if (hours > 0) {
              durationStr = `${hours}h ${minutes}m`;
            } else {
              durationStr = `${minutes} mins`;
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to fetch OSRM route details, falling back to estimation:', error);
    }

    // Fallback logic if still Unknown
    if (distanceStr === 'Unknown' || durationStr === 'Unknown') {
      try {
        const startLat = ride.from.latitude;
        const startLon = ride.from.longitude;
        const endLat = ride.to.latitude;
        const endLon = ride.to.longitude;

        if (startLat && startLon && endLat && endLon) {
          // Haversine formula
          const R = 6371; // km
          const dLat = (endLat - startLat) * Math.PI / 180;
          const dLon = (endLon - startLon) * Math.PI / 180;
          const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(startLat * Math.PI / 180) * Math.cos(endLat * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          const straightDistance = R * c;
          
          // Apply routing correction factor (approx 1.3x for city driving)
          const estimatedDistance = straightDistance * 1.3;
          distanceStr = `${estimatedDistance.toFixed(1)} km`;

          // Estimate duration assuming average speed of 45 km/h (including traffic/stops)
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
      } catch (err) {
        console.error('Fallback estimation failed:', err);
      }
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
      status: statusMap[ride.status] || 'active',
      distance: distanceStr,
      duration: durationStr,
      pickupDistanceMeters: searchData.pickupDistanceMeters,
      dropoffDistanceMeters: searchData.dropoffDistanceMeters,
      polyline: searchData.polyline,
      preferences: {
        nonSmoking: ride.preference ? !ride.preference.allowSmoking : true,
        musicAllowed: ride.preference ? ride.preference.allowMusic : true,
        petsAllowed: ride.preference ? ride.preference.allowPets : false,
        airConditioning: features.includes('ac'),
        conversationLevel: (ride.preference && convMap[ride.preference.conversationLevel]) || 'moderate',
      },
    };
  };

  const mapBookingData = async (booking: BookingResponseDto): Promise<Booking> => {
    let ride: Ride | null = null;
    try {
      const rideData = await rideService.getRideById(booking.rideId);
      ride = await mapRideData(rideData);
    } catch (e) {
      console.error('Error fetching ride for booking:', e);
    }

    return {
      id: booking.bookingId,
      rideId: booking.rideId,
      userId: booking.userId,
      ride: ride!,
      seats: booking.seats,
      totalPrice: booking.totalPrice,
      status: booking.status.toLowerCase() as any,
      bookingDate: booking.bookingDate,
      passengerName: booking.passengerName,
      passengerPhone: booking.passengerPhone,
    };
  };

  const searchRides = async (params: {
    from: string;
    to: string;
    date: string;
    fromCoords?: { latitude: number; longitude: number };
    toCoords?: { latitude: number; longitude: number };
    seats?: number;
    maxPrice?: number;
    allowPets?: boolean;
    allowMusic?: boolean;
  }): Promise<Ride[]> => {
    setIsLoading(true);
    try {
      const results = await rideService.searchRides({
        From: params.from,
        To: params.to,
        Date: params.date,
        FromCoords: params.fromCoords,
        ToCoords: params.toCoords,
        Seats: params.seats,
        MaxPrice: params.maxPrice,
        AllowPets: params.allowPets,
        AllowMusic: params.allowMusic
      });
      const mappedResults = await Promise.all(results.map(mapRideData));
      return mappedResults;
    } catch (error) {
      console.error('Error searching rides:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const createRide = async (rideData: any): Promise<boolean> => {
    setIsLoading(true);
    try {
      const departureTime = `${rideData.date}T${rideData.time}:00Z`;
      
      await rideService.createRide({
        vehicleId: rideData.vehicleId,
        fromAddress: rideData.from.address,
        fromLat: rideData.from.coordinates.latitude,
        fromLng: rideData.from.coordinates.longitude,
        toAddress: rideData.to.address,
        toLat: rideData.to.coordinates.latitude,
        toLng: rideData.to.coordinates.longitude,
        departureTime,
        pricePerSeat: rideData.price,
        totalSeats: rideData.totalSeats,
        allowMusic: rideData.preferences?.musicAllowed ?? true,
        allowSmoking: !rideData.preferences?.nonSmoking,
        allowPets: rideData.preferences?.petsAllowed ?? false,
        conversationLevel: rideData.preferences?.conversationLevel === 'quiet' ? ConversationLevel.Quiet :
                          rideData.preferences?.conversationLevel === 'chatty' ? ConversationLevel.Chatty : ConversationLevel.Moderate
      });
      await loadInitialData();
      return true;
    } catch (error) {
      console.error('Error creating ride:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const updateRide = async (rideId: string, rideData: Partial<Ride>): Promise<boolean> => {
    setIsLoading(true);
    try {
      await rideService.updateRide(rideId, rideData);
      await loadInitialData();
      return true;
    } catch (error) {
      console.error('Error updating ride:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const cancelRide = async (rideId: string, reason: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      await rideService.cancelRide(rideId, reason);
      await loadInitialData();
      return true;
    } catch (error) {
      console.error('Error cancelling ride:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const startRide = async (rideId: string): Promise<boolean> => {
    try {
      await rideService.startRide(rideId);
      await loadInitialData();
      return true;
    } catch (e) {
      return false;
    }
  };

  const arriveAtPickup = async (rideId: string, lat?: number, lng?: number): Promise<boolean> => {
    try {
      await rideService.arriveAtPickup(rideId, lat, lng);
      await loadInitialData();
      return true;
    } catch (e) {
      return false;
    }
  };

  const startBoarding = async (rideId: string): Promise<boolean> => {
    try {
      await rideService.startBoarding(rideId);
      await loadInitialData();
      return true;
    } catch (e) {
      return false;
    }
  };

  const transitionEnRoute = async (rideId: string): Promise<boolean> => {
    try {
      await rideService.transitionEnRoute(rideId);
      await loadInitialData();
      return true;
    } catch (e) {
      return false;
    }
  };

  const completeDropoff = async (rideId: string): Promise<boolean> => {
    try {
      await rideService.completeDropoff(rideId);
      await loadInitialData();
      return true;
    } catch (e) {
      return false;
    }
  };

  const completeRide = async (rideId: string): Promise<boolean> => {
    try {
      await rideService.completeRide(rideId);
      await loadInitialData();
      return true;
    } catch (e) {
      return false;
    }
  };

  const bookRide = async (rideId: string, seats: number, passengerData: any): Promise<boolean> => {
    setIsLoading(true);
    try {
      await bookingService.createBooking({
        rideId,
        seats,
        passengerName: passengerData.name,
        passengerPhone: passengerData.phone,
        acceptTerms: true
      });
      await loadInitialData();
      return true;
    } catch (error) {
      console.error('Error booking ride:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const confirmBooking = async (bookingId: string): Promise<boolean> => {
    try {
      await bookingService.confirmBooking(bookingId);
      await loadInitialData();
      return true;
    } catch (e) {
      return false;
    }
  };

  const completeBooking = async (bookingId: string): Promise<boolean> => {
    try {
      await bookingService.completeBooking(bookingId);
      await loadInitialData();
      return true;
    } catch (e) {
      return false;
    }
  };

  const cancelBooking = async (bookingId: string, reason: string = 'User cancelled'): Promise<boolean> => {
    setIsLoading(true);
    try {
      await bookingService.cancelBooking(bookingId, reason);
      await loadInitialData();
      return true;
    } catch (error) {
      console.error('Error cancelling booking:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const rateRide = async (rideId: string, rating: number, review: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const booking = bookings.find(b => b.rideId === rideId && b.userId === user?.id);
      if (!booking) return false;

      await reviewService.createReview({
        bookingId: booking.id,
        rideId: rideId,
        reviewedUserId: booking.ride.driverId,
        targetType: 0, // Driver
        rating: rating,
        comment: review,
        isAnonymous: false
      });
      return true;
    } catch (error) {
      console.error('Error rating ride:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const updateTracking = async (rideId: string, latitude: number, longitude: number) => {
    try {
      await rideService.updateTracking(rideId, { latitude, longitude });
    } catch (e) {
      console.error('Error updating tracking:', e);
    }
  };

  const getTracking = async (rideId: string) => {
    try {
      return await rideService.getTracking(rideId);
    } catch (e) {
      return null;
    }
  };

  const getUserRides = async (userId: string): Promise<Ride[]> => {
    try {
      const data = await rideService.getMyRides();
      return Promise.all(data.map(mapRideData));
    } catch (e) {
      return [];
    }
  };

  const getUserBookings = async (userId: string): Promise<Booking[]> => {
    try {
      const data = await bookingService.getMyBookings();
      return Promise.all(data.map(mapBookingData));
    } catch (e) {
      return [];
    }
  };

  const getRideById = async (rideId: string): Promise<Ride | null> => {
    try {
      const data = await rideService.getRideById(rideId);
      return mapRideData(data);
    } catch (e) {
      return null;
    }
  };

  const getBookingById = async (bookingId: string): Promise<Booking | null> => {
    try {
      const data = await bookingService.getBookingById(bookingId);
      return await mapBookingData(data);
    } catch (e) {
      console.error('Error fetching booking by ID:', e);
      return null;
    }
  };

  return (
    <RideContext.Provider 
      value={{ 
        rides, 
        bookings, 
        myRides, 
        isLoading, 
        searchRides, 
        createRide, 
        updateRide,
        cancelRide,
        startRide,
        arriveAtPickup,
        startBoarding,
        transitionEnRoute,
        completeDropoff,
        completeRide,
        bookRide, 
        confirmBooking,
        completeBooking,
        cancelBooking, 
        rateRide,
        updateTracking,
        getTracking,
        getUserRides,
        getUserBookings,
        getRideById,
        getBookingById,
        loadInitialData
      }}
    >
      {children}
    </RideContext.Provider>
  );
}

export function useRides() {
  const context = useContext(RideContext);
  if (context === undefined) {
    throw new Error('useRides must be used within a RideProvider');
  }
  return context;
}
