import React from 'react';
import { render, fireEvent, waitFor, act, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import RideDetailsScreen from '../app/ride/details';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useRides } from '../contexts/RideContext';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { bookingService } from '@/services/booking.service';

jest.mock('../contexts/ThemeContext');
jest.mock('../contexts/AuthContext');
jest.mock('../contexts/RideContext');
jest.mock('@/services/booking.service', () => ({
  bookingService: {
    getRideBookings: jest.fn(),
  },
}));
jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(),
}));
jest.mock('../components/RouteMap', () => 'RouteMap');
jest.mock('expo-location', () => ({
  watchPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { High: 4, Balanced: 3 },
}));
jest.mock('../utils/permissions', () => ({
  checkLocationPermission: jest.fn().mockResolvedValue(true),
  requestLocationPermission: jest.fn().mockResolvedValue({ granted: true }),
}));

// Mock lucide-react-native icons
jest.mock('lucide-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  const mockIcon = (name: string) => (props: any) => React.createElement(View, { ...props, testID: name });
  return {
    ArrowLeft: mockIcon('ArrowLeft'),
    MapPin: mockIcon('MapPin'),
    Calendar: mockIcon('Calendar'),
    Clock: mockIcon('Clock'),
    Star: mockIcon('Star'),
    Phone: mockIcon('Phone'),
    MessageCircle: mockIcon('MessageCircle'),
    Users: mockIcon('Users'),
    Car: mockIcon('Car'),
    CheckCircle: mockIcon('CheckCircle'),
    XCircle: mockIcon('XCircle'),
    ShieldCheck: mockIcon('ShieldCheck'),
    Cigarette: mockIcon('Cigarette'),
    Heart: mockIcon('Heart'),
    Wind: mockIcon('Wind'),
    Music: mockIcon('Music'),
    Play: mockIcon('Play'),
    Navigation: mockIcon('Navigation'),
  };
});

describe('DriverRideDetailsScreen', () => {
  const mockTheme = {
    colors: {
      primary: '#4F46E5',
      background: '#FFFFFF',
      card: '#F9FAFB',
      border: '#E5E7EB',
      text: '#111827',
      textSecondary: '#6B7280',
      error: '#EF4444',
      success: '#10B981',
      warning: '#F59E0B',
      surface: '#FFFFFF',
      secondary: '#10B981',
    },
  };

  const mockRide = {
    id: 'r1',
    driverId: 'd1', // Matches logged-in user id 'd1'
    driverName: 'Alice Johnson',
    driverRating: 4.9,
    from: {
      address: 'Downtown, San Francisco, CA',
      coordinates: { latitude: 37.7749, longitude: -122.4194 }
    },
    to: {
      address: 'Silicon Valley, Palo Alto, CA',
      coordinates: { latitude: 37.4419, longitude: -122.1430 }
    },
    date: '2024-01-20',
    time: '08:30',
    price: 25,
    availableSeats: 2,
    totalSeats: 3,
    carModel: 'Toyota Camry',
    carColor: 'Blue',
    carPlate: 'ABC-1234',
    status: 'published',
    distance: '35 km',
    duration: '45 mins',
    preferences: {
      nonSmoking: true,
      musicAllowed: true,
      petsAllowed: false,
      airConditioning: true,
      conversationLevel: 'moderate',
    }
  };

  const mockBookings = [
    {
      id: 'b1',
      rideId: 'r1',
      userId: 'p1',
      passengerName: 'Bob Smith',
      passengerPhone: '+1234567890',
      seats: 1,
      totalPrice: 25,
      status: 'pending',
    }
  ];

  const mockPush = jest.fn();
  const mockReplace = jest.fn();
  const mockBack = jest.fn();
  const mockGetRideById = jest.fn();
  const mockConfirmBooking = jest.fn();
  const mockCancelBooking = jest.fn();
  const mockCancelRide = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useTheme as jest.Mock).mockReturnValue({ theme: mockTheme });
    (useAuth as jest.Mock).mockReturnValue({ user: { id: 'd1', fullName: 'Driver User' } });
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'r1' });
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush, replace: mockReplace, back: mockBack });
    
    (useRides as jest.Mock).mockReturnValue({
      getRideById: mockGetRideById,
      confirmBooking: mockConfirmBooking,
      cancelBooking: mockCancelBooking,
      startRide: jest.fn().mockResolvedValue(true),
      arriveAtPickup: jest.fn().mockResolvedValue(true),
      startBoarding: jest.fn().mockResolvedValue(true),
      transitionEnRoute: jest.fn().mockResolvedValue(true),
      completeDropoff: jest.fn().mockResolvedValue(true),
      completeRide: jest.fn().mockResolvedValue(true),
      cancelRide: mockCancelRide,
      updateTracking: jest.fn(),
      getTracking: jest.fn(),
    });

    mockGetRideById.mockResolvedValue(mockRide);
    (bookingService.getRideBookings as jest.Mock).mockResolvedValue(mockBookings);
    mockConfirmBooking.mockResolvedValue(true);
    mockCancelBooking.mockResolvedValue(true);
    mockCancelRide.mockResolvedValue(true);
  });

  it('renders ride details and passenger bookings section for drivers', async () => {
    const { getByText, queryByText, getAllByText } = render(<RideDetailsScreen />);

    await waitFor(() => {
      // General ride details
      expect(getAllByText('Downtown, San Francisco, CA').length).toBeGreaterThanOrEqual(2);
      expect(getAllByText('Silicon Valley, Palo Alto, CA').length).toBeGreaterThanOrEqual(2);
      expect(getAllByText('Toyota Camry').length).toBeGreaterThanOrEqual(1);
      
      // Driver details should be hidden for the driver themselves
      expect(queryByText('Alice Johnson')).toBeNull();

      // Passenger bookings section
      expect(getByText('Passenger Bookings')).toBeTruthy();
      expect(getByText('Bob Smith')).toBeTruthy();
      expect(getByText('1 Seat requested')).toBeTruthy();
      expect(getByText('Booking #B1')).toBeTruthy();
      expect(getByText('Pending')).toBeTruthy();
      
      // Check requested locations are displayed in the passenger booking card
      expect(getByText(/From:/)).toBeTruthy();
      expect(getByText(/To:/)).toBeTruthy();
    });
  });

  it('allows the driver to accept a pending booking request', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByText } = render(<RideDetailsScreen />);

    await waitFor(() => {
      expect(getByText('Accept Request')).toBeTruthy();
    });

    // Press Accept Request
    fireEvent.press(getByText('Accept Request'));

    // Verify Alert confirmation shows up
    expect(alertSpy).toHaveBeenCalledWith(
      'Confirm Booking Request',
      expect.any(String),
      expect.any(Array)
    );

    // Call the Confirm onPress handler manually
    const confirmButtonHandler = alertSpy.mock.calls[0][2]?.[1]?.onPress;
    if (confirmButtonHandler) {
      await act(async () => {
        await confirmButtonHandler();
      });
    }

    expect(mockConfirmBooking).toHaveBeenCalledWith('b1');
    expect(bookingService.getRideBookings).toHaveBeenCalledTimes(2); // Initial + reload

    alertSpy.mockRestore();
  });

  it('allows the driver to decline a pending booking request', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByText } = render(<RideDetailsScreen />);

    await waitFor(() => {
      expect(getByText('Decline')).toBeTruthy();
    });

    // Press Decline
    fireEvent.press(getByText('Decline'));

    // Verify Alert confirmation shows up
    expect(alertSpy).toHaveBeenCalledWith(
      'Decline Booking Request',
      expect.any(String),
      expect.any(Array)
    );

    // Call the Decline onPress handler manually
    const declineButtonHandler = alertSpy.mock.calls[0][2]?.[1]?.onPress;
    if (declineButtonHandler) {
      await act(async () => {
        await declineButtonHandler();
      });
    }

    expect(mockCancelBooking).toHaveBeenCalledWith('b1', 'Declined by driver');
    expect(bookingService.getRideBookings).toHaveBeenCalledTimes(2); // Initial + reload

    alertSpy.mockRestore();
  });

  it('renders CTA to open the Journey Command Center', async () => {
    const { getByText } = render(<RideDetailsScreen />);

    await waitFor(() => {
      expect(getByText('Open Journey Command Center')).toBeTruthy();
    });

    // Tap CTA
    fireEvent.press(getByText('Open Journey Command Center'));

    // Verify it navigates to command center
    expect(mockPush).toHaveBeenCalledWith('/ride/command-center?id=r1');
  });

  it('renders CTA to resume the ride if ride status is already started', async () => {
    mockGetRideById.mockResolvedValue({
      ...mockRide,
      status: 'ridestarted',
    });

    const { getByText } = render(<RideDetailsScreen />);

    await waitFor(() => {
      expect(getByText('Resume Ride in Command Center')).toBeTruthy();
    });

    // Tap CTA
    fireEvent.press(getByText('Resume Ride in Command Center'));

    // Verify it navigates to command center
    expect(mockPush).toHaveBeenCalledWith('/ride/command-center?id=r1');
  });
});
