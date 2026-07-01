// Enums
export enum UserRole {
  Passenger = 0,
  Driver = 1,
  Admin = 2,
}

export enum RideStatus {
  Draft = 0,
  Published = 1,
  Scheduled = 2,
  RideStarted = 3,
  ArrivedAtPickup = 4,
  Boarding = 5,
  InTransit = 6,
  ArrivedAtDrop = 7,
  DropOff = 8,
  Completed = 9,
  Cancelled = 10,
}

// Matches backend RidePhase enum (if used)
export enum RidePhase {
  PreRide = 0,
  EnRoute = 1,
  AtPickup = 2,
  Boarding = 3,
  InTransit = 4,
  AtDrop = 5,
  Completed = 6,
}

export enum BookingStatus {
  Pending = 0,
  Confirmed = 1,
  Rejected = 2,
  Cancelled = 3,
  ReadyForBoarding = 4,
  Boarded = 5,
  InRide = 6,
  ReadyForDrop = 7,
  Completed = 8,
  NoShow = 9,
}

export enum StopStatus {
  Pending = 0,
  Navigating = 1,
  Arrived = 2,
  Completed = 3,
}

export enum StopType {
  Pickup = 0,
  Dropoff = 1,
}

export enum ConversationLevel {
  Quiet = 0,
  Moderate = 1,
  Chatty = 2,
}

export enum VehicleDocumentType {
  License = 0,
  Aadhar = 1,
  VehicleRC = 2,
}

export enum FeatureCategory {
  Comfort = 0,
  Safety = 1,
  Entertainment = 2,
  Accessibility = 3,
}

export enum ReviewTargetType {
  PassengerToDriver = 0,
  DriverToPassenger = 1,
}

export enum ReviewFlagReason {
  InappropriateContent = 0,
  Spam = 1,
  FakeReview = 2,
  Harassment = 3,
}

export enum NotificationType {
  Information = 0,
  Alert = 1,
  Warning = 2,
  Success = 3,
}

export enum NotificationChannel {
  Push = 0,
  Sms = 1,
  Email = 2,
  InApp = 3,
}

// Common DTOs
export interface LocationDto {
  address: string;
  latitude: number;
  longitude: number;
}

export interface UserProfileDto {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  role: string;
  status: string;
  rating: number;
  isVerified: boolean;
  profilePictureUrl: string | null;
  createdAt: string;
  isGoogleLinked?: boolean;
}

export interface RidePreferenceDto {
  allowMusic: boolean;
  allowSmoking: boolean;
  allowPets: boolean;
  conversationLevel: ConversationLevel;
}

export interface RideStopDto {
  id: string;
  rideId: string;
  bookingId: string;
  stopName: string;
  address: string;
  latitude: number;
  longitude: number;
  type: StopType;
  status: StopStatus;
  sequence: number;
}

export interface RideDto {
  id: string;
  driverId: string;
  vehicleId: string;
  from: LocationDto;
  to: LocationDto;
  departureTime: string;
  pricePerSeat: number;
  totalSeats: number;
  availableSeats: number;
  status: RideStatus;
  currentPhase?: any;
  currentPassengerId: string | null;
  stops: RideStopDto[];
  preference: RidePreferenceDto;
  createdAt: string;
  distanceKm?: number;
  durationMinutes?: number;
  rideCategory?: string;
}

export interface RideSearchDto extends RideDto {
  pickupDistanceMeters: number;
  dropoffDistanceMeters: number;
  polyline: string;
}

export interface BookingResponseDto {
  bookingId: string;
  rideId: string;
  userId: string;
  seats: number;
  totalPrice: number;
  status: string;
  bookingDate: string;
  passengerName: string;
  passengerPhone: string;
  specialRequest: string | null;
  cancellationReason: string | null;
  cancelledAt: string | null;
}

export interface VehicleResponseDto {
  id: string;
  driverId: string;
  brand: string;
  model: string;
  color: string;
  registrationNumber: string;
  totalSeats: number;
  status: string;
  isDefault: boolean;
  createdAt: string;
}

export interface VehicleFeatureDto {
  id: string;
  featureCode: string;
  featureName: string;
  category: FeatureCategory;
}

export interface VehiclePhotoDto {
  id: string;
  fileUrl: string;
  isPrimary: boolean;
  status: string;
}

export interface VehiclePreferenceDto {
  allowMusic: boolean;
  allowSmoking: boolean;
  allowPets: boolean;
  conversationLevel: ConversationLevel;
  requireVerifiedPassengers: boolean;
}

export interface ReviewResponseDto {
  id: string;
  rideId: string;
  bookingId: string;
  reviewerUserId: string;
  reviewedUserId: string;
  targetType: ReviewTargetType;
  rating: number;
  comment: string | null;
  status: string;
  isAnonymous: boolean;
  createdAt: string;
}

export interface RatingSummaryDto {
  userId: string;
  totalReviews: number;
  averageRating: number;
  fiveStarCount: number;
  fourStarCount: number;
  threeStarCount: number;
  twoStarCount: number;
  oneStarCount: number;
}

export interface FlagReviewDto {
  reviewId: string;
  reason: ReviewFlagReason;
  description: string;
}

export interface EmergencyContactDto {
  id: string;
  name: string;
  phoneNumber: string;
  relation: string | null;
  isPrimary: boolean;
  isActive: boolean;
}

export interface SafetyIncidentDto {
  id: string;
  userId: string;
  rideId: string | null;
  incidentType: string;
  status: string;
  description: string;
  createdAt: string;
}

export interface NotificationResponseDto {
  id: string;
  userId: string | null;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  body: string;
  status: string;
  scheduledAt: string;
  sentAt: string | null;
  createdAt: string;
}

export interface NotificationPreferenceDto {
  enablePush: boolean;
  enableSms: boolean;
  enableEmail: boolean;
  enableInApp: boolean;
  rideUpdatesEnabled: boolean;
  bookingUpdatesEnabled: boolean;
  safetyAlertsEnabled: boolean;
  promotionsEnabled: boolean;
  preferredLanguage: string | null;
}

// Request DTOs
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterUserCommand {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  role: UserRole;
}

export interface CreateRideCommand {
  vehicleId: string;
  fromAddress: string;
  fromLat: number;
  fromLng: number;
  toAddress: string;
  toLat: number;
  toLng: number;
  departureTime: string;
  pricePerSeat: number;
  totalSeats: number;
  allowMusic?: boolean;
  allowSmoking?: boolean;
  allowPets?: boolean;
  conversationLevel?: ConversationLevel;
}

export interface CreateBookingDto {
  rideId: string;
  seats: number;
  passengerName: string;
  passengerPhone: string;
  specialRequest?: string | null;
  acceptTerms: boolean;
}

export interface TriggerSosDto {
  rideId?: string | null;
  description?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}
