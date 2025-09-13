import React, { createContext, useContext, useState, useEffect } from 'react';
import { mockRides, mockBookings } from '@/data/mockData';

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
  createRide: (rideData: Partial<Ride>) => Promise<boolean>;
  bookRide: (rideId: string, seats: number, passengerData: any) => Promise<boolean>;
  cancelBooking: (bookingId: string) => Promise<boolean>;
  rateRide: (rideId: string, rating: number, review: string) => Promise<boolean>;
  getUserRides: (userId: string) => Ride[];
  getUserBookings: (userId: string) => Booking[];
}

const RideContext = createContext<RideContextType | undefined>(undefined);

export function RideProvider({ children }: { children: React.ReactNode }) {
  const [rides, setRides] = useState<Ride[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [myRides, setMyRides] = useState<Ride[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      // Load mock data
      setRides(mockRides);
      setBookings(mockBookings);
      setMyRides(mockRides.slice(0, 2)); // Mock user's rides
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const searchRides = async (from: string, to: string, date: string): Promise<Ride[]> => {
    setIsLoading(true);
    try {
      // Mock search - replace with real API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const filteredRides = mockRides.filter(ride => 
        ride.from.address.toLowerCase().includes(from.toLowerCase()) &&
        ride.to.address.toLowerCase().includes(to.toLowerCase()) &&
        ride.date === date
      );
      
      return filteredRides;
    } catch (error) {
      console.error('Error searching rides:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const createRide = async (rideData: Partial<Ride>): Promise<boolean> => {
    setIsLoading(true);
    try {
      const newRide: Ride = {
        id: Date.now().toString(),
        driverId: '1', // Current user ID
        driverName: 'John Doe',
        driverRating: 4.8,
        from: rideData.from!,
        to: rideData.to!,
        date: rideData.date!,
        time: rideData.time!,
        price: rideData.price!,
        availableSeats: rideData.availableSeats!,
        totalSeats: rideData.totalSeats!,
        carModel: rideData.carModel!,
        carColor: rideData.carColor!,
        status: 'active',
        distance: '25 km',
        duration: '30 min',
      };

      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setRides(prev => [newRide, ...prev]);
      setMyRides(prev => [newRide, ...prev]);
      
      return true;
    } catch (error) {
      console.error('Error creating ride:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const bookRide = async (rideId: string, seats: number, passengerData: any): Promise<boolean> => {
    setIsLoading(true);
    try {
      const ride = rides.find(r => r.id === rideId);
      if (!ride || ride.availableSeats < seats) {
        return false;
      }

      const newBooking: Booking = {
        id: Date.now().toString(),
        rideId,
        userId: '1', // Current user ID
        ride,
        seats,
        totalPrice: ride.price * seats,
        status: 'confirmed',
        bookingDate: new Date().toISOString(),
        passengerName: passengerData.name,
        passengerPhone: passengerData.phone,
      };

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Update ride availability
      setRides(prev => prev.map(r => 
        r.id === rideId 
          ? { ...r, availableSeats: r.availableSeats - seats }
          : r
      ));

      setBookings(prev => [newBooking, ...prev]);
      
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
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setBookings(prev => prev.map(b => 
        b.id === bookingId 
          ? { ...b, status: 'cancelled' }
          : b
      ));
      
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
      // Mock rating submission
      await new Promise(resolve => setTimeout(resolve, 500));
      return true;
    } catch (error) {
      console.error('Error rating ride:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const getUserRides = (userId: string): Ride[] => {
    return rides.filter(ride => ride.driverId === userId);
  };

  const getUserBookings = (userId: string): Booking[] => {
    return bookings.filter(booking => booking.userId === userId);
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
        bookRide, 
        cancelBooking, 
        rateRide,
        getUserRides,
        getUserBookings
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