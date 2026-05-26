import React, { createContext, useContext, useState } from 'react';
import { reviewService } from '@/services/review.service';
import { ReviewResponseDto, RatingSummaryDto } from '@/utils/types';

interface ReviewContextType {
  isLoading: boolean;
  getReviewsByTarget: (userId: string) => Promise<ReviewResponseDto[]>;
  getReviewsByRide: (rideId: string) => Promise<ReviewResponseDto[]>;
  getReviewByBooking: (bookingId: string) => Promise<ReviewResponseDto | null>;
  getRatingSummary: (userId: string) => Promise<RatingSummaryDto | null>;
  submitReview: (data: any) => Promise<string | null>;
  flagReview: (id: string, reason: any) => Promise<boolean>;
}

const ReviewContext = createContext<ReviewContextType | undefined>(undefined);

export function ReviewProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);

  const getReviewsByTarget = async (userId: string) => {
    try {
      setIsLoading(true);
      return await reviewService.getByTargetId(userId);
    } catch (e) {
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const getReviewsByRide = async (rideId: string) => {
    try {
      return await reviewService.getByRideId(rideId);
    } catch (e) {
      return [];
    }
  };

  const getReviewByBooking = async (bookingId: string) => {
    try {
      return await reviewService.getByBookingId(bookingId);
    } catch (e) {
      return null;
    }
  };

  const getRatingSummary = async (userId: string) => {
    try {
      return await reviewService.getSummary(userId);
    } catch (e) {
      return null;
    }
  };

  const submitReview = async (data: any) => {
    try {
      setIsLoading(true);
      return await reviewService.createReview(data);
    } catch (e) {
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const flagReview = async (id: string, reason: any) => {
    try {
      await reviewService.flagReview(id, reason);
      return true;
    } catch (e) {
      return false;
    }
  };

  return (
    <ReviewContext.Provider value={{ 
      isLoading, 
      getReviewsByTarget, 
      getReviewsByRide, 
      getReviewByBooking, 
      getRatingSummary, 
      submitReview, 
      flagReview 
    }}>
      {children}
    </ReviewContext.Provider>
  );
}

export function useReviews() {
  const context = useContext(ReviewContext);
  if (context === undefined) {
    throw new Error('useReviews must be used within a ReviewProvider');
  }
  return context;
}
