import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import BookingsScreen from '../app/(tabs)/bookings';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useRides } from '../contexts/RideContext';
import { useRouter } from 'expo-router';

jest.mock('../contexts/AuthContext');
jest.mock('../contexts/ThemeContext');
jest.mock('../contexts/RideContext');
jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

describe('BookingsScreen', () => {
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
    },
  };

  const mockBookings = [
    {
      id: 'b1',
      rideId: 'r1',
      seats: 2,
      totalPrice: 40.0,
      status: 'confirmed',
      bookingDate: '2026-05-24T12:00:00Z',
      ride: {
        id: 'r1',
        driverName: 'John Doe',
        driverRating: 4.8,
        driverAvatar: 'https://example.com/avatar.jpg',
        from: { address: 'Origin City' },
        to: { address: 'Destination City' },
        date: '2026-05-25',
        time: '08:00',
        price: 20.0,
      },
    },
    {
      id: 'b2',
      rideId: 'r2',
      seats: 1,
      totalPrice: 15.0,
      status: 'completed',
      bookingDate: '2026-05-20T12:00:00Z',
      ride: {
        id: 'r2',
        driverName: 'Jane Smith',
        driverRating: 4.9,
        driverAvatar: 'https://example.com/avatar2.jpg',
        from: { address: 'Downtown' },
        to: { address: 'Airport' },
        date: '2026-05-21',
        time: '14:30',
        price: 15.0,
      },
    },
  ];

  const mockCancelBooking = jest.fn().mockResolvedValue(true);
  const mockLoadInitialData = jest.fn().mockResolvedValue(undefined);
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
    (useAuth as jest.Mock).mockReturnValue({ user: { id: 'user1' } });
    (useRouter as jest.Mock).mockReturnValue({ push: jest.fn() });
    (useRides as jest.Mock).mockReturnValue({
      bookings: mockBookings,
      cancelBooking: mockCancelBooking,
      loadInitialData: mockLoadInitialData,
      isLoading: false,
    });
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('renders loading state when loading and bookings are empty', () => {
    (useRides as jest.Mock).mockReturnValue({
      bookings: [],
      cancelBooking: mockCancelBooking,
      loadInitialData: mockLoadInitialData,
      isLoading: true,
    });

    const { getByTestId } = render(<BookingsScreen />);
    expect(getByTestId('loading-indicator')).toBeTruthy();
  });

  it('renders upcoming bookings by default', () => {
    const { getByText, queryByText } = render(<BookingsScreen />);
    
    expect(getByText('John Doe')).toBeTruthy();
    expect(getByText('Origin City')).toBeTruthy();
    expect(getByText('Destination City')).toBeTruthy();
    expect(getByText('Booking #B1')).toBeTruthy();
    
    // Past booking John Doe should not be rendered on the upcoming tab
    expect(queryByText('Jane Smith')).toBeNull();
  });

  it('renders past bookings when past tab is selected', () => {
    const { getByText, queryByText } = render(<BookingsScreen />);
    
    // Switch to Past tab
    fireEvent.press(getByText('Past'));
    
    expect(getByText('Jane Smith')).toBeTruthy();
    expect(getByText('Downtown')).toBeTruthy();
    expect(getByText('Airport')).toBeTruthy();
    expect(getByText('Booking #B2')).toBeTruthy();
    
    // Upcoming booking John Doe should not be visible on past tab
    expect(queryByText('John Doe')).toBeNull();
  });

  it('renders empty state correctly when there are no bookings', () => {
    (useRides as jest.Mock).mockReturnValue({
      bookings: [],
      cancelBooking: mockCancelBooking,
      loadInitialData: mockLoadInitialData,
      isLoading: false,
    });

    const { getByText } = render(<BookingsScreen />);
    expect(getByText('No upcoming bookings')).toBeTruthy();
  });
});
