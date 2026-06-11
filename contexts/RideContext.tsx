import React, { createContext, useContext, useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { rideService } from '@/services/ride.service';
import { bookingService } from '@/services/booking.service';
import { reviewService } from '@/services/review.service';
import { userService } from '@/services/user.service';
import { vehicleService } from '@/services/vehicle.service';
import { useAuth } from './AuthContext';
import { RideDto, BookingResponseDto, RideStatus, ConversationLevel, RideSearchDto } from '@/utils/types';
import { CACHE_KEYS } from '@/cache/cacheKeys';
import { sqliteStorage } from '@/storage/sqlite';
import { mapRideData, mapBookingData, Ride, Booking } from '@/utils/mappers';
import { useActiveRidesQuery, useMyRidesQuery } from '@/hooks/useRides';
import { useMyBookingsQuery } from '@/hooks/useBookings';

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
  verifyBooking: (bookingId: string, data: { verificationType: 'OTP' | 'QR'; otp?: string; qrToken?: string }) => Promise<boolean>;
  completeStop: (rideId: string, stopId: string) => Promise<boolean>;
  cancelBooking: (bookingId: string, reason?: string) => Promise<boolean>;
  rateRide: (
    rideId: string,
    bookingId: string,
    reviewedUserId: string,
    targetRole: 'driver' | 'passenger',
    rating: number,
    review: string
  ) => Promise<boolean>;
  updateTracking: (rideId: string, latitude: number, longitude: number) => Promise<void>;
  getTracking: (rideId: string) => Promise<any>;
  getUserRides: (userId: string) => Promise<Ride[]>;
  getUserBookings: (userId: string) => Promise<Booking[]>;
  getRideById: (rideId: string) => Promise<Ride | null>;
  getBookingById: (bookingId: string) => Promise<Booking | null>;
  loadInitialData: () => Promise<void>;
}

const RideContext = createContext<RideContextType | undefined>(undefined);

export function RideProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Queries leveraging cache layer
  const activeRidesQuery = useActiveRidesQuery();
  const myRidesQuery = useMyRidesQuery();
  const bookingsQuery = useMyBookingsQuery();

  const rides = activeRidesQuery.data || [];
  const bookings = bookingsQuery.data || [];
  const myRides = myRidesQuery.data || [];
  const isLoading = activeRidesQuery.isLoading || bookingsQuery.isLoading || myRidesQuery.isLoading;

  const loadInitialData = async () => {
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.rides] }),
        queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.bookings] }),
      ]);
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
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
    const searchKey = `${params.from}_${params.to}_${params.date}`;
    
    // Save to SQLite search history
    if (params.from && params.to) {
      try {
        await sqliteStorage.addSearchHistory(`${params.from} to ${params.to}`);
      } catch (e) {
        console.warn('Failed to save search history', e);
      }
    }

    try {
      const netState = await NetInfo.fetch();
      
      if (!netState.isConnected) {
        const cached = await sqliteStorage.getCachedRides(searchKey);
        if (cached) return cached as Ride[];
        return [];
      }

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
      
      // Store in SQLite cache
      try {
        await sqliteStorage.cacheRides(searchKey, mappedResults);
      } catch (e) {
        console.warn('Failed to cache rides in SQLite', e);
      }

      return mappedResults;
    } catch (error) {
      console.error('Error searching rides:', error);
      // Try fallback to cache on API error
      try {
        const cached = await sqliteStorage.getCachedRides(searchKey);
        if (cached) return cached as Ride[];
      } catch {}
      return [];
    }
  };

  const createRide = async (rideData: any): Promise<boolean> => {
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
      // Invalidate active & my rides to trigger reactive refetching
      await queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.rides] });
      return true;
    } catch (error) {
      console.error('Error creating ride:', error);
      return false;
    }
  };

  const updateRide = async (rideId: string, rideData: Partial<Ride>): Promise<boolean> => {
    try {
      await rideService.updateRide(rideId, rideData);
      await queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.rides] });
      await queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.rideDetails, rideId] });
      return true;
    } catch (error) {
      console.error('Error updating ride:', error);
      return false;
    }
  };

  const cancelRide = async (rideId: string, reason: string): Promise<boolean> => {
    try {
      await rideService.cancelRide(rideId, reason);
      await queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.rides] });
      await queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.rideDetails, rideId] });
      await queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.bookings] });
      return true;
    } catch (error) {
      console.error('Error cancelling ride:', error);
      return false;
    }
  };

  const startRide = async (rideId: string): Promise<boolean> => {
    try {
      await rideService.startRide(rideId);
      await queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.rides] });
      await queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.rideDetails, rideId] });
      return true;
    } catch (e) {
      return false;
    }
  };

  const arriveAtPickup = async (rideId: string, lat?: number, lng?: number): Promise<boolean> => {
    try {
      await rideService.arriveAtPickup(rideId, lat, lng);
      await queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.rides] });
      await queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.rideDetails, rideId] });
      return true;
    } catch (e) {
      return false;
    }
  };

  const startBoarding = async (rideId: string): Promise<boolean> => {
    try {
      await rideService.startBoarding(rideId);
      await queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.rides] });
      await queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.rideDetails, rideId] });
      return true;
    } catch (e) {
      return false;
    }
  };

  const transitionEnRoute = async (rideId: string): Promise<boolean> => {
    try {
      await rideService.transitionEnRoute(rideId);
      await queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.rides] });
      await queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.rideDetails, rideId] });
      return true;
    } catch (e) {
      return false;
    }
  };

  const completeDropoff = async (rideId: string): Promise<boolean> => {
    try {
      await rideService.completeDropoff(rideId);
      await queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.rides] });
      await queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.rideDetails, rideId] });
      return true;
    } catch (e) {
      return false;
    }
  };

  const completeRide = async (rideId: string): Promise<boolean> => {
    try {
      await rideService.completeRide(rideId);
      await queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.rides] });
      await queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.activeRide] });
      await queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.rideDetails, rideId] });
      await queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.bookings] });
      return true;
    } catch (e) {
      return false;
    }
  };

  const bookRide = async (rideId: string, seats: number, passengerData: any): Promise<boolean> => {
    try {
      await bookingService.createBooking({
        rideId,
        seats,
        passengerName: passengerData.name,
        passengerPhone: passengerData.phone,
        specialRequest: passengerData.specialRequest,
        acceptTerms: true
      });
      // Invalidate bookings & rides
      await queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.bookings] });
      await queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.rides] });
      await queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.rideDetails, rideId] });
      return true;
    } catch (error) {
      console.error('Error booking ride:', error);
      return false;
    }
  };

  const confirmBooking = async (bookingId: string): Promise<boolean> => {
    try {
      await bookingService.confirmBooking(bookingId);
      await queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.bookings] });
      await queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.rides] });
      return true;
    } catch (e) {
      return false;
    }
  };

  const completeBooking = async (bookingId: string): Promise<boolean> => {
    try {
      await bookingService.completeBooking(bookingId);
      await queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.bookings] });
      await queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.rides] });
      return true;
    } catch (e) {
      return false;
    }
  };

  const verifyBooking = async (bookingId: string, data: { verificationType: 'OTP' | 'QR'; otp?: string; qrToken?: string }): Promise<boolean> => {
    try {
      await bookingService.verifyBooking(bookingId, data);
      await queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.bookings] });
      await queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.rides] });
      return true;
    } catch (e) {
      return false;
    }
  };

  const completeStop = async (rideId: string, stopId: string): Promise<boolean> => {
    try {
      await rideService.completeStop(rideId, stopId);
      await queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.rides] });
      await queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.rideDetails, rideId] });
      return true;
    } catch (e) {
      return false;
    }
  };

  const cancelBooking = async (bookingId: string, reason: string = 'User cancelled'): Promise<boolean> => {
    try {
      await bookingService.cancelBooking(bookingId, reason);
      await queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.bookings] });
      await queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.rides] });
      return true;
    } catch (error) {
      console.error('Error cancelling booking:', error);
      return false;
    }
  };

  const rateRide = async (
    rideId: string,
    bookingId: string,
    reviewedUserId: string,
    targetRole: 'driver' | 'passenger',
    rating: number,
    review: string
  ): Promise<boolean> => {
    try {
      await reviewService.createReview({
        bookingId: bookingId,
        rideId: rideId,
        reviewedUserId: reviewedUserId,
        targetType: targetRole === 'driver' ? 0 : 1,
        rating: rating,
        comment: review,
        isAnonymous: false
      });
      // Invalidate queries to refresh states
      await queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.rides] });
      return true;
    } catch (error) {
      console.error('Error submitting review:', error);
      return false;
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
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        const cached = queryClient.getQueryData<Ride>([CACHE_KEYS.rideDetails, rideId]);
        if (cached) return cached;
      }
      
      const ride = await rideService.getRideById(rideId);
      const mapped = await mapRideData(ride);
      queryClient.setQueryData([CACHE_KEYS.rideDetails, rideId], mapped);
      return mapped;
    } catch (e) {
      console.warn('Error fetching ride by ID from API, trying cache:', e);
      const cached = queryClient.getQueryData<Ride>([CACHE_KEYS.rideDetails, rideId]);
      if (cached) return cached;
      return null;
    }
  };

  const getBookingById = async (bookingId: string): Promise<Booking | null> => {
    try {
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        const cached = queryClient.getQueryData<Booking>([CACHE_KEYS.bookings, bookingId]);
        if (cached) return cached;
      }

      const data = await bookingService.getBookingById(bookingId);
      const mapped = await mapBookingData(data);
      queryClient.setQueryData([CACHE_KEYS.bookings, bookingId], mapped);
      return mapped;
    } catch (e) {
      console.error('Error fetching booking by ID, trying cache:', e);
      const cached = queryClient.getQueryData<Booking>([CACHE_KEYS.bookings, bookingId]);
      if (cached) return cached;
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
        verifyBooking,
        completeStop,
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
