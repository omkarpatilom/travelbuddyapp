import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingService } from '../services/booking.service';
import { CACHE_KEYS } from '../cache/cacheKeys';
import { mapBookingData } from '../utils/mappers';
import { useAuth } from '../contexts/AuthContext';

export function useMyBookingsQuery() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [CACHE_KEYS.bookings, 'my'],
    queryFn: async () => {
      const data = await bookingService.getMyBookings();
      return await Promise.all(data.map(mapBookingData));
    },
    enabled: !!user,
  });
}

export function useBookingDetailsQuery(id: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [CACHE_KEYS.bookings, id],
    queryFn: async () => {
      const data = await bookingService.getBookingById(id);
      return await mapBookingData(data);
    },
    enabled: !!user && !!id,
  });
}

export function useCreateBookingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { rideId: string; seats: number; passengerName: string; passengerPhone: string; specialRequest?: string }) => {
      return await bookingService.createBooking({
        rideId: payload.rideId,
        seats: payload.seats,
        passengerName: payload.passengerName,
        passengerPhone: payload.passengerPhone,
        specialRequest: payload.specialRequest,
        acceptTerms: true
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.bookings] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.rides] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.rideDetails, variables.rideId] });
    },
  });
}

export function useCancelBookingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ bookingId, reason }: { bookingId: string; reason: string }) => {
      return await bookingService.cancelBooking(bookingId, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.bookings] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.rides] });
    },
  });
}

export function useConfirmBookingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (bookingId: string) => {
      return await bookingService.confirmBooking(bookingId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.bookings] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.rides] });
    },
  });
}

export function useCompleteBookingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (bookingId: string) => {
      return await bookingService.completeBooking(bookingId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.bookings] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.rides] });
    },
  });
}
