import { api } from '../utils/api';
import { CreateBookingDto, BookingResponseDto } from '../utils/types';

export const bookingService = {
  async createBooking(data: CreateBookingDto) {
    return api.post<BookingResponseDto>('/bookings', data);
  },

  async getBookingById(bookingId: string) {
    return api.get<BookingResponseDto>(`/bookings/${bookingId}`);
  },

  async cancelBooking(bookingId: string, reason: string) {
    return api.post<boolean>(`/bookings/${bookingId}/cancel`, { reason });
  },

  async confirmBooking(bookingId: string) {
    return api.post<boolean>(`/bookings/${bookingId}/confirm`, {});
  },

  async completeBooking(bookingId: string) {
    return api.post<boolean>(`/bookings/${bookingId}/complete`, {});
  },

  async getMyBookings() {
    return api.get<BookingResponseDto[]>('/bookings/my-bookings');
  },

  async getRideBookings(rideId: string) {
    return api.get<BookingResponseDto[]>(`/bookings/ride/${rideId}`);
  },
};
