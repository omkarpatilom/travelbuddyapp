import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { rideService } from '../services/ride.service';
import { sqliteStorage } from '../storage/sqlite';
import { CACHE_KEYS } from '../cache/cacheKeys';
import { CACHE_TTL } from '../cache/cacheConfig';
import { mapRideData, Ride } from '../utils/mappers';
import { useAuth } from '../contexts/AuthContext';

export function useActiveRidesQuery() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [CACHE_KEYS.rides, 'active'],
    queryFn: async () => {
      const activeRides = await rideService.getActiveRides();
      return await Promise.all(activeRides.map(mapRideData));
    },
    staleTime: CACHE_TTL.RIDE_SEARCH,
    gcTime: CACHE_TTL.DEFAULT_GC,
    enabled: !!user,
  });
}

export function useMyRidesQuery() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [CACHE_KEYS.rides, 'my-rides'],
    queryFn: async () => {
      const myRides = await rideService.getMyRides();
      return await Promise.all(myRides.map(mapRideData));
    },
    staleTime: CACHE_TTL.USER_PROFILE,
    enabled: !!user && (user.role === 'Driver' || user.role === 'Admin'),
  });
}

export function useRideDetailsQuery(id: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [CACHE_KEYS.rideDetails, id],
    queryFn: async () => {
      const ride = await rideService.getRideById(id);
      return await mapRideData(ride);
    },
    staleTime: CACHE_TTL.RIDE_DETAILS,
    enabled: !!user && !!id,
  });
}

export function useSearchRides(params: {
  from: string;
  to: string;
  date: string;
  fromCoords?: { latitude: number; longitude: number };
  toCoords?: { latitude: number; longitude: number };
  seats?: number;
  maxPrice?: number;
  allowPets?: boolean;
  allowMusic?: boolean;
}) {
  const { user } = useAuth();
  const searchKey = `${params.from}_${params.to}_${params.date}`;

  return useQuery({
    queryKey: [CACHE_KEYS.rides, 'search', searchKey],
    queryFn: async () => {
      const netState = await NetInfo.fetch();
      
      if (params.from && params.to) {
        try {
          await sqliteStorage.addSearchHistory(`${params.from} to ${params.to}`);
        } catch (e) {
          console.warn('Failed to save search history', e);
        }
      }

      if (!netState.isConnected) {
        const cached = await sqliteStorage.getCachedRides(searchKey);
        if (cached) {
          return cached as Ride[];
        }
        throw new Error('No internet connection. No cached results available.');
      }

      const apiResults = await rideService.searchRides({
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

      const mapped = await Promise.all(apiResults.map(mapRideData));

      try {
        await sqliteStorage.cacheRides(searchKey, mapped);
      } catch (e) {
        console.warn('Failed to cache rides in SQLite', e);
      }

      return mapped;
    },
    staleTime: CACHE_TTL.RIDE_SEARCH,
    enabled: !!user && !!params.from && !!params.to && !!params.date,
  });
}

export function useCreateRideMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rideData: any) => {
      const departureTime = `${rideData.date}T${rideData.time}:00Z`;
      return await rideService.createRide({
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
        conversationLevel: rideData.preferences?.conversationLevel === 'quiet' ? 0 :
                          rideData.preferences?.conversationLevel === 'chatty' ? 2 : 1
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.rides] });
    },
  });
}

export function useCancelRideMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ rideId, reason }: { rideId: string; reason: string }) => {
      return await rideService.cancelRide(rideId, reason);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.rides] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.rideDetails, variables.rideId] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.bookings] });
    },
  });
}

export function useStartRideMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rideId: string) => {
      return await rideService.startRide(rideId);
    },
    onSuccess: (_, rideId) => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.rides] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.rideDetails, rideId] });
    },
  });
}

export function useCompleteRideMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rideId: string) => {
      return await rideService.completeRide(rideId);
    },
    onSuccess: (_, rideId) => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.rides] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.activeRide] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.rideDetails, rideId] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.bookings] });
    },
  });
}
