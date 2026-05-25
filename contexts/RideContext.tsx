import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '@/utils/api';
import { useAuth } from './AuthContext';

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
  status: 'active' | 'completed' | 'cancelled';
  distance: string;
  duration: string;
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
  searchRides: (from: string, to: string, date: string) => Promise<Ride[]>;
  createRide: (rideData: any) => Promise<boolean>;
  updateRide: (rideId: string, rideData: Partial<Ride>) => Promise<boolean>;
  bookRide: (rideId: string, seats: number, passengerData: any) => Promise<boolean>;
  cancelBooking: (bookingId: string) => Promise<boolean>;
  rateRide: (rideId: string, rating: number, review: string) => Promise<boolean>;
  getUserRides: (userId: string) => Promise<Ride[]>;
  getUserBookings: (userId: string) => Promise<Booking[]>;
  getRideById: (rideId: string) => Promise<Ride | null>;
  getBookingById: (bookingId: string) => Promise<Booking | null>;
  loadInitialData: () => Promise<void>;
}

const RideContext = createContext<RideContextType | undefined>(undefined);

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
      // Fetch active rides
      const activeRidesData = await api.get<any[]>('/rides/active');
      const mappedRides = await Promise.all(activeRidesData.map(mapRideData));
      setRides(mappedRides);

      // Fetch user's bookings
      const bookingsData = await api.get<any[]>('/bookings/my-bookings');
      const mappedBookings = await Promise.all(bookingsData.map(mapBookingData));
      setBookings(mappedBookings);

      // Fetch user's offered rides if they are a driver
      if (user?.role === 'Driver') {
        const myRidesData = await api.get<any[]>('/rides/my-rides');
        const mappedMyRides = await Promise.all(myRidesData.map(mapRideData));
        setMyRides(mappedMyRides);
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const mapRideData = async (ride: any): Promise<Ride> => {
    // In a real app, we'd fetch driver and vehicle details if not provided
    // For now, we'll use placeholders for missing fields
    return {
      id: ride.id,
      driverId: ride.driverId,
      driverName: 'Driver', // Will be enriched if needed
      driverRating: 4.5,
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
      carModel: 'Vehicle', // Will be enriched
      carColor: 'Silver',
      status: ride.status.toLowerCase() === 'active' ? 'active' : ride.status.toLowerCase(),
      distance: 'Unknown',
      duration: 'Unknown',
    };
  };

  const mapBookingData = async (booking: any): Promise<Booking> => {
    let ride: Ride | null = null;
    try {
      const rideData = await api.get<any>(`/rides/${booking.rideId}`);
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

  const searchRides = async (from: string, to: string, date: string): Promise<Ride[]> => {
    setIsLoading(true);
    try {
      const results = await api.get<any[]>(`/rides/search?from=${from}&to=${to}&date=${date}`);
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
      
      const payload = {
        vehicleId: rideData.vehicleId, // Assumes vehicle selection is implemented
        from: {
          address: rideData.from.address,
          latitude: rideData.from.coordinates.latitude,
          longitude: rideData.from.coordinates.longitude
        },
        to: {
          address: rideData.to.address,
          latitude: rideData.to.coordinates.latitude,
          longitude: rideData.to.coordinates.longitude
        },
        departureTime,
        pricePerSeat: rideData.price,
        totalSeats: rideData.totalSeats,
        preference: {
          allowMusic: true,
          allowSmoking: false,
          allowPets: false,
          conversationLevel: 'Moderate'
        }
      };

      await api.post('/rides', payload);
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
      await api.put(`/rides/${rideId}`, rideData);
      await loadInitialData();
      return true;
    } catch (error) {
      console.error('Error updating ride:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const bookRide = async (rideId: string, seats: number, passengerData: any): Promise<boolean> => {
    setIsLoading(true);
    try {
      const payload = {
        rideId,
        seats,
        passengerName: passengerData.name,
        passengerPhone: passengerData.phone,
        acceptTerms: true
      };

      await api.post('/bookings', payload);
      await loadInitialData();
      return true;
    } catch (error) {
      console.error('Error booking ride:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const cancelBooking = async (bookingId: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      await api.post(`/bookings/${bookingId}/cancel`, { reason: 'User cancelled' });
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
      // Find the booking for this ride
      const booking = bookings.find(b => b.rideId === rideId && b.userId === user?.id);
      if (!booking) return false;

      await api.post('/reviews', {
        bookingId: booking.id,
        rideId,
        targetUserId: booking.ride.driverId,
        targetType: 'Driver',
        rating,
        comment: review
      });
      return true;
    } catch (error) {
      console.error('Error rating ride:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const getUserRides = async (userId: string): Promise<Ride[]> => {
    try {
      const data = await api.get<any[]>(`/rides/my-rides`);
      return Promise.all(data.map(mapRideData));
    } catch (e) {
      return [];
    }
  };

  const getUserBookings = async (userId: string): Promise<Booking[]> => {
    try {
      const data = await api.get<any[]>(`/bookings/my-bookings`);
      return Promise.all(data.map(mapBookingData));
    } catch (e) {
      return [];
    }
  };

  const getRideById = async (rideId: string): Promise<Ride | null> => {
    try {
      const data = await api.get<any>(`/rides/${rideId}`);
      return mapRideData(data);
    } catch (e) {
      return null;
    }
  };

  const getBookingById = async (bookingId: string): Promise<Booking | null> => {
    try {
      const data = await api.get<any>(`/bookings/${bookingId}`);
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
        bookRide, 
        cancelBooking, 
        rateRide,
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