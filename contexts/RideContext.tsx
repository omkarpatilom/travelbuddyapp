import React, { createContext, useContext, useState, useEffect } from 'react';
import { rideService } from '@/services/ride.service';
import { bookingService } from '@/services/booking.service';
import { reviewService } from '@/services/review.service';
import { userService } from '@/services/user.service';
import { useAuth } from './AuthContext';
import { RideDto, BookingResponseDto, RideStatus, ConversationLevel } from '@/utils/types';

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
  status: 'active' | 'completed' | 'cancelled' | 'started' | 'scheduled';
  distance: string;
  duration: string;
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
    from: string, 
    to: string, 
    date: string, 
    options?: { seats?: number; maxPrice?: number; allowPets?: boolean; allowMusic?: boolean }
  ) => Promise<Ride[]>;
  createRide: (rideData: any) => Promise<boolean>;
  updateRide: (rideId: string, rideData: Partial<Ride>) => Promise<boolean>;
  cancelRide: (rideId: string, reason: string) => Promise<boolean>;
  startRide: (rideId: string) => Promise<boolean>;
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

  const mapRideData = async (ride: RideDto): Promise<Ride> => {
    let driverName = 'Driver';
    let driverRating = 4.5;
    let driverAvatar = undefined;

    try {
      if (!driverCache[ride.driverId]) {
        driverCache[ride.driverId] = await userService.getById(ride.driverId);
      }
      const driverProfile = driverCache[ride.driverId];
      driverName = driverProfile.fullName;
      driverRating = driverProfile.rating;
      driverAvatar = driverProfile.profilePictureUrl || undefined;
    } catch (e) {
      console.warn(`Could not fetch driver profile for ${ride.driverId}`);
    }

    const statusMap: Record<RideStatus, any> = {
      [RideStatus.Scheduled]: 'scheduled',
      [RideStatus.Active]: 'active',
      [RideStatus.Started]: 'started',
      [RideStatus.Completed]: 'completed',
      [RideStatus.Cancelled]: 'cancelled',
    };

    const convMap: Record<ConversationLevel, any> = {
      [ConversationLevel.Quiet]: 'quiet',
      [ConversationLevel.Moderate]: 'moderate',
      [ConversationLevel.Chatty]: 'chatty',
    };

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
      carModel: 'Vehicle', // Backend doesn't return this in RideDto yet
      carColor: 'Silver',
      status: statusMap[ride.status] || 'active',
      distance: 'Unknown',
      duration: 'Unknown',
      preferences: {
        nonSmoking: !ride.preference.allowSmoking,
        musicAllowed: ride.preference.allowMusic,
        petsAllowed: ride.preference.allowPets,
        airConditioning: true,
        conversationLevel: convMap[ride.preference.conversationLevel] || 'moderate',
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
    From: string;
    To: string;
    Date: string;
    Seats?: number;
    MaxPrice?: number;
    AllowPets?: boolean;
    AllowMusic?: boolean;
  }): Promise<Ride[]> => {
    setIsLoading(true);
    try {
      const results = await rideService.searchRides(params);
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
