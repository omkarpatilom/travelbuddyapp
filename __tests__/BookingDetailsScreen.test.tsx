import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import BookingDetailsScreen from '../app/booking/details';
import { useTheme } from '../contexts/ThemeContext';
import { useRides } from '../contexts/RideContext';
import { useAuth } from '../contexts/AuthContext';
import { useRouter, useLocalSearchParams } from 'expo-router';

jest.mock('../contexts/ThemeContext');
jest.mock('../contexts/RideContext');
jest.mock('../contexts/AuthContext');
jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(),
}));
jest.mock('../components/RatingModal', () => 'RatingModal');

// Locally mock lucide-react-native to include the Navigation icon
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
    CreditCard: mockIcon('CreditCard'),
    Navigation: mockIcon('Navigation'),
    X: mockIcon('X'),
  };
});

describe('BookingDetailsScreen', () => {
  const mockTheme = {
    colors: {
      primary: '#000',
      background: '#fff',
      card: '#f9f9f9',
      border: '#eee',
      text: '#000',
      textSecondary: '#666',
      error: '#f00',
      success: '#0f0',
      warning: '#f0f',
      surface: '#fff',
      secondary: '#333',
    },
  };

  const mockBooking = {
    id: 'b1',
    seats: 2,
    totalPrice: 40.0,
    status: 'confirmed',
    bookingDate: '2026-05-24T12:00:00Z',
    ride: {
      id: 'r1',
      driverName: 'John Doe',
      driverRating: 4.8,
      driverAvatar: 'https://example.com/avatar.jpg',
      from: { 
        address: 'Origin City',
        coordinates: { latitude: 12.97, longitude: 77.59 },
      },
      to: { 
        address: 'Destination City',
        coordinates: { latitude: 13.08, longitude: 80.27 },
      },
      date: '2026-05-25',
      time: '08:00',
      price: 20.0,
      carModel: 'Toyota Innova',
    },
  };

  const mockGetBookingById = jest.fn();
  const mockCancelBooking = jest.fn();
  let errorSpy: jest.SpyInstance;

  beforeAll(() => {
    // @ts-ignore
    global.window = global.window || {};
    // @ts-ignore
    global.window.dispatchEvent = jest.fn();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    (useTheme as jest.Mock).mockReturnValue({ theme: mockTheme });
    (useAuth as jest.Mock).mockReturnValue({ user: { id: 'u1' } });
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'b1' });
    (useRouter as jest.Mock).mockReturnValue({ back: jest.fn() });
    
    (useRides as jest.Mock).mockReturnValue({
      getBookingById: mockGetBookingById,
      cancelBooking: mockCancelBooking,
    });

    mockGetBookingById.mockResolvedValue(mockBooking);
    mockCancelBooking.mockResolvedValue(true);
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('renders loading state initially', async () => {
    mockGetBookingById.mockReturnValue(new Promise(() => {})); // Never resolves to keep loading state active
    const { getByTestId } = render(<BookingDetailsScreen />);
    
    expect(getByTestId('loading-indicator')).toBeTruthy();
  });

  it('renders booking details when loaded successfully', async () => {
    const { getByText, getAllByText } = render(<BookingDetailsScreen />);
    
    await waitFor(() => {
      expect(getByText('Booking #B1')).toBeTruthy();
      expect(getAllByText('Origin City').length).toBeGreaterThanOrEqual(1);
      expect(getAllByText('Destination City').length).toBeGreaterThanOrEqual(1);
      expect(getByText('John Doe')).toBeTruthy();
      expect(getByText('Toyota Innova')).toBeTruthy();
      expect(getByText('₹ 40')).toBeTruthy(); // Total price
      expect(getByText('2 seats')).toBeTruthy();
    });
  });

  it('renders error state when booking fails to load', async () => {
    mockGetBookingById.mockRejectedValue(new Error('Network failure'));
    
    const { getByText } = render(<BookingDetailsScreen />);
    
    await waitFor(() => {
      expect(getByText('Network failure')).toBeTruthy();
      expect(getByText('Retry')).toBeTruthy();
    });
  });

  it('retries fetching details when Retry is clicked', async () => {
    mockGetBookingById.mockRejectedValueOnce(new Error('Fetch failed')).mockResolvedValueOnce(mockBooking);
    
    const { getByText } = render(<BookingDetailsScreen />);
    
    // First, verify error screen is rendered
    await waitFor(() => {
      expect(getByText('Fetch failed')).toBeTruthy();
    });
    
    // Click retry
    await act(async () => {
      fireEvent.press(getByText('Retry'));
    });
    
    // Now verify booking details are loaded
    await waitFor(() => {
      expect(getByText('Booking #B1')).toBeTruthy();
    });
  });
});
