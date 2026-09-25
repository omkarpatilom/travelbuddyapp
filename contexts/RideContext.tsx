import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { rideService } from '@/services/ride.service';
import { bookingService } from '@/services/booking.service';
import { useAuth } from './AuthContext';
import { CACHE_KEYS } from '@/cache/cacheKeys';
import { sqliteStorage } from '@/storage/sqlite';
import { mapRideData, mapBookingData, Ride, Booking } from '@/utils/mappers';
import {
  useActiveRidesQuery,
  useMyRidesQuery,
  createRideOp,
  cancelRideOp,
  rideTransitionOp,
  rateRideOp,
  RideTransitionVars,
} from '@/hooks/useRides';
import {
  useMyBookingsQuery,
  createBookingOp,
  confirmBookingOp,
  completeBookingOp,
  verifyBookingOp,
  cancelBookingOp,
} from '@/hooks/useBookings';
import { OperationDef, runOperation } from '@/hooks/mutations/operations';
import { applyOverlays } from '@/cache/entityCache';

interface RideContextType {
  rides: Ride[];
  bookings: Booking[];
  myRides: Ride[];
  // Combined OR of all three queries below - kept for existing consumers.
  // Prefer the per-query flags for a screen that only cares about one list,
  // so a slow unrelated query elsewhere doesn't visually stall it.
  isLoading: boolean;
  isLoadingActiveRides: boolean;
  isLoadingMyRides: boolean;
  isLoadingBookings: boolean;
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
  publishRide: (rideId: string) => Promise<boolean>;
  cancelRide: (rideId: string, reason: string) => Promise<boolean>;
  startRide: (rideId: string) => Promise<boolean>;
  arriveAtPickup: (rideId: string, lat?: number, lng?: number) => Promise<boolean>;
  startBoarding: (rideId: string) => Promise<boolean>;
  transitionEnRoute: (rideId: string) => Promise<boolean>;
  arriveAtDrop: (rideId: string, lat?: number, lng?: number) => Promise<boolean>;
  completeDropoff: (rideId: string) => Promise<boolean>;
  completeRide: (rideId: string) => Promise<boolean>;
  bookRide: (rideId: string, seats: number, passengerData: any) => Promise<boolean>;
  confirmBooking: (bookingId: string) => Promise<boolean>;
  completeBooking: (bookingId: string) => Promise<boolean>;
  verifyBooking: (bookingId: string, data: { verificationType: 'OTP' | 'QR'; otp?: string; qrToken?: string }) => Promise<boolean>;
  completeStop: (rideId: string, stopId: string) => Promise<boolean>;
  overrideTransition: (rideId: string, targetStatus: number, reason: string) => Promise<boolean>;
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

// Stable fallbacks so the memoised context value doesn't change every render.
const EMPTY_RIDES: Ride[] = [];
const EMPTY_BOOKINGS: Booking[] = [];

const RideContext = createContext<RideContextType | undefined>(undefined);

export function RideProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Queries leveraging cache layer
  const activeRidesQuery = useActiveRidesQuery();
  const myRidesQuery = useMyRidesQuery();
  const bookingsQuery = useMyBookingsQuery();

  const rides = activeRidesQuery.data ?? EMPTY_RIDES;
  const bookings = bookingsQuery.data ?? EMPTY_BOOKINGS;
  const myRides = myRidesQuery.data ?? EMPTY_RIDES;
  const isLoading = activeRidesQuery.isLoading || bookingsQuery.isLoading || myRidesQuery.isLoading;

  console.log('[DEBUG] RideProvider state:', {
    userRole: user?.role,
    activeRidesCount: rides.length,
    myRidesCount: myRides.length,
    bookingsCount: bookings.length,
    activeRidesLoading: activeRidesQuery.isLoading,
    myRidesLoading: myRidesQuery.isLoading,
    bookingsLoading: bookingsQuery.isLoading,
    isLoading
  });

  const loadInitialData = useCallback(async () => {
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.rides] }),
        queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.bookings] }),
      ]);
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  }, [queryClient]);

  const searchRides = useCallback(async (params: {
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
  }, [queryClient]);

  /**
   * Context mutations are thin wrappers over the shared operations in
   * hooks/useRides.ts and hooks/useBookings.ts, so every caller gets the same
   * optimistic/pending cache updates, rollback, ordering and duplicate
   * protection. They keep their original contract (resolve to a boolean,
   * never throw). A duplicate call joins the request already in flight.
   */
  const run = useCallback(
    async <V, D>(def: OperationDef<V, D, any>, vars: V, label: string): Promise<boolean> => {
      try {
        await runOperation(queryClient, def, vars, { isHandledByCaller: () => true, joinDuplicate: true });
        return true;
      } catch (error) {
        console.error(`Error ${label}:`, error);
        return false;
      }
    },
    [queryClient],
  );

  const createRide = useCallback((rideData: any) => run(createRideOp, rideData, 'creating ride'), [run]);

  const updateRide = useCallback(async (rideId: string, rideData: Partial<Ride>): Promise<boolean> => {
    try {
      await rideService.updateRide(rideId, rideData);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.rides] }),
        queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.rideDetails, rideId] }),
      ]);
      return true;
    } catch (error) {
      console.error('Error updating ride:', error);
      return false;
    }
  }, [queryClient]);

  const cancelRide = useCallback(
    (rideId: string, reason: string) => run(cancelRideOp, { rideId, reason }, 'cancelling ride'),
    [run],
  );

  const transition = useCallback(
    (vars: RideTransitionVars) => run(rideTransitionOp, vars, `ride transition ${vars.action}`),
    [run],
  );

  const publishRide = useCallback((rideId: string) => transition({ rideId, action: 'publish' }), [transition]);
  const startRide = useCallback((rideId: string) => transition({ rideId, action: 'start' }), [transition]);
  const arriveAtPickup = useCallback(
    (rideId: string, lat?: number, lng?: number) => transition({ rideId, action: 'arrivePickup', lat, lng }),
    [transition],
  );
  const startBoarding = useCallback((rideId: string) => transition({ rideId, action: 'boarding' }), [transition]);
  const transitionEnRoute = useCallback((rideId: string) => transition({ rideId, action: 'enRoute' }), [transition]);
  const arriveAtDrop = useCallback(
    (rideId: string, lat?: number, lng?: number) => transition({ rideId, action: 'arriveDrop', lat, lng }),
    [transition],
  );
  const completeDropoff = useCallback((rideId: string) => transition({ rideId, action: 'dropoff' }), [transition]);
  const completeRide = useCallback((rideId: string) => transition({ rideId, action: 'complete' }), [transition]);
  const overrideTransition = useCallback(
    (rideId: string, targetStatus: number, reason: string) =>
      transition({ rideId, action: 'override', targetStatus, reason }),
    [transition],
  );
  const completeStop = useCallback(
    (rideId: string, stopId: string) => transition({ rideId, action: 'completeStop', stopId }),
    [transition],
  );

  const bookRide = useCallback(
    (rideId: string, seats: number, passengerData: any) =>
      run(createBookingOp, {
        rideId,
        seats,
        passengerName: passengerData.name,
        passengerPhone: passengerData.phone,
        specialRequest: passengerData.specialRequest,
      }, 'booking ride'),
    [run],
  );

  const confirmBooking = useCallback(
    (bookingId: string) => run(confirmBookingOp, { bookingId }, 'confirming booking'),
    [run],
  );

  const completeBooking = useCallback(
    (bookingId: string) => run(completeBookingOp, { bookingId }, 'completing booking'),
    [run],
  );

  const verifyBooking = useCallback(
    (bookingId: string, data: { verificationType: 'OTP' | 'QR'; otp?: string; qrToken?: string }) =>
      run(verifyBookingOp, { bookingId, data }, 'verifying booking'),
    [run],
  );

  const cancelBooking = useCallback(
    (bookingId: string, reason: string = 'User cancelled') =>
      run(cancelBookingOp, { bookingId, reason }, 'cancelling booking'),
    [run],
  );

  const rateRide = useCallback(
    (
      rideId: string,
      bookingId: string,
      reviewedUserId: string,
      targetRole: 'driver' | 'passenger',
      rating: number,
      review: string
    ) => run(rateRideOp, { rideId, bookingId, reviewedUserId, targetRole, rating, review }, 'submitting review'),
    [run],
  );

  const updateTracking = useCallback(async (rideId: string, latitude: number, longitude: number) => {
    try {
      await rideService.updateTracking(rideId, { latitude, longitude });
    } catch (e) {
      console.error('Error updating tracking:', e);
    }
  }, [queryClient]);

  const getTracking = useCallback(async (rideId: string) => {
    try {
      return await rideService.getTracking(rideId);
    } catch (e) {
      return null;
    }
  }, [queryClient]);

  const getUserRides = useCallback(async (userId: string): Promise<Ride[]> => {
    try {
      const data = await rideService.getMyRides();
      return Promise.all(data.map(mapRideData));
    } catch (e) {
      return [];
    }
  }, [queryClient]);

  const getUserBookings = useCallback(async (userId: string): Promise<Booking[]> => {
    try {
      const data = await bookingService.getMyBookings();
      return Promise.all(data.map(mapBookingData));
    } catch (e) {
      return [];
    }
  }, [queryClient]);

  const getRideById = useCallback(async (rideId: string): Promise<Ride | null> => {
    try {
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        const cached = queryClient.getQueryData<Ride>([CACHE_KEYS.rideDetails, rideId]);
        if (cached) return cached;
      }
      
      const ride = await rideService.getRideById(rideId);
      const mapped = applyOverlays('ride', await mapRideData(ride));
      queryClient.setQueryData([CACHE_KEYS.rideDetails, rideId], mapped);
      return mapped;
    } catch (e) {
      console.warn('Error fetching ride by ID from API, trying cache:', e);
      const cached = queryClient.getQueryData<Ride>([CACHE_KEYS.rideDetails, rideId]);
      if (cached) return cached;
      return null;
    }
  }, [queryClient]);

  const getBookingById = useCallback(async (bookingId: string): Promise<Booking | null> => {
    try {
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        const cached = queryClient.getQueryData<Booking>([CACHE_KEYS.bookings, bookingId]);
        if (cached) return cached;
      }

      const data = await bookingService.getBookingById(bookingId);
      const mapped = applyOverlays('booking', await mapBookingData(data));
      queryClient.setQueryData([CACHE_KEYS.bookings, bookingId], mapped);
      return mapped;
    } catch (e) {
      console.error('Error fetching booking by ID, trying cache:', e);
      const cached = queryClient.getQueryData<Booking>([CACHE_KEYS.bookings, bookingId]);
      if (cached) return cached;
      return null;
    }
  }, [queryClient]);

  const value = useMemo<RideContextType>(() => ({
        rides,
        bookings,
        myRides,
        isLoading,
        isLoadingActiveRides: activeRidesQuery.isLoading,
        isLoadingMyRides: myRidesQuery.isLoading,
        isLoadingBookings: bookingsQuery.isLoading,
        searchRides,
        createRide, 
        updateRide,
        publishRide,
        cancelRide,
        startRide,
        arriveAtPickup,
        startBoarding,
        transitionEnRoute,
        arriveAtDrop,
        completeDropoff,
        completeRide,
        bookRide, 
        confirmBooking,
        completeBooking,
        verifyBooking,
        completeStop,
        overrideTransition,
        cancelBooking, 
        rateRide,
        updateTracking,
        getTracking,
        getUserRides,
        getUserBookings,
        getRideById,
        getBookingById,
        loadInitialData
  }), [
    rides, bookings, myRides, isLoading,
    activeRidesQuery.isLoading, myRidesQuery.isLoading, bookingsQuery.isLoading,
    searchRides, createRide, updateRide, publishRide, cancelRide, startRide, arriveAtPickup,
    startBoarding, transitionEnRoute, arriveAtDrop, completeDropoff, completeRide, bookRide,
    confirmBooking, completeBooking, verifyBooking, completeStop, overrideTransition,
    cancelBooking, rateRide, updateTracking, getTracking, getUserRides, getUserBookings,
    getRideById, getBookingById, loadInitialData,
  ]);

  return (
    <RideContext.Provider value={value}>
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
export type { Ride, Booking } from '@/utils/mappers';