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

  /** Driver-only: marks a boarded passenger as at the drop point (Boarded -> ReadyForDrop). */
  async reachDrop(bookingId: string) {
    return api.post<boolean>(`/bookings/${bookingId}/reach-drop`, {});
  },

  async verifyBooking(bookingId: string, data: { verificationType: 'OTP' | 'QR'; otp?: string; qrToken?: string }) {
    return api.post<boolean>(`/bookings/${bookingId}/verify`, data);
  },

  async getBookingOtp(bookingId: string) {
    return api.get<string>(`/bookings/${bookingId}/otp`);
  },

  async getMyBookings() {
    return api.get<BookingResponseDto[]>('/bookings/my-bookings');
  },

  async getRideBookings(rideId: string) {
    return api.get<BookingResponseDto[]>(`/bookings/ride/${rideId}`);
  },
};
