import { api } from '../utils/api';
import { ReviewResponseDto, RatingSummaryDto, FlagReviewDto } from '../utils/types';

export const reviewService = {
  async createReview(data: any) {
    return api.post<string>('/reviews', data);
  },

  async getById(id: string) {
    return api.get<ReviewResponseDto>(`/reviews/${id}`);
  },

  async updateReview(id: string, data: any) {
    return api.put<void>(`/reviews/${id}`, data);
  },

  async deleteReview(id: string) {
    return api.delete<void>(`/reviews/${id}`);
  },

  async getByUserId(userId: string) {
    return api.get<ReviewResponseDto[]>(`/reviews/user/${userId}`);
  },

  async getByTargetId(userId: string) {
    return api.get<ReviewResponseDto[]>(`/reviews/target/${userId}`);
  },

  async getMyReviews() {
    return api.get<ReviewResponseDto[]>('/reviews/my-reviews');
  },

  async getByRideId(rideId: string) {
    return api.get<ReviewResponseDto[]>(`/reviews/ride/${rideId}`);
  },

  async getByBookingId(bookingId: string) {
    return api.get<ReviewResponseDto>(`/reviews/booking/${bookingId}`);
  },

  async getSummary(userId: string) {
    return api.get<RatingSummaryDto>(`/reviews/summary/user/${userId}`);
  },

  async flagReview(id: string, data: FlagReviewDto) {
    return api.post<void>(`/reviews/${id}/flag`, data);
  },
};
